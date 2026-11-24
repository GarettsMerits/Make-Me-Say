/**
 * Chat route
 *
 * SECURITY MODEL:
 * - The client never supplies the target word or conversation history directly.
 * - First message: client sends a `targetWordId` (numeric DB PK); the server
 *   resolves the real word string, so the client cannot forge it.
 * - Later messages: client sends only `sessionId` + `message`; the server
 *   reads target word and history from the DB — the client cannot tamper.
 */
import express from 'express';
import type { Request, Response } from 'express';
import { CHAT_MESSAGE_MAX_LENGTH } from '../domain/limits.js';
import { clientErrorMessage, clientStatusCode, HttpError } from '../http/HttpError.js';
import { abandonSession, declineSession, resolveSession } from '../services/sessionService.js';
import { sessionTurnGate } from '../services/SessionTurnGate.js';
import { runTurn } from '../services/chatOrchestrator.js';

const router = express.Router();
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

// ─── POST /api/chat ───────────────────────────────────────────────────────────

/**
 * Process a player message and stream the LLM response.
 *
 * First message  → body: { targetWordId: number, message: string }
 * Later messages → body: { sessionId: string,    message: string }
 *
 * SSE events emitted:
 *   meta        { sessionId }
 *   chunk       { text }          — repeated for each LLM delta
 *   done        { sessionId, tokenCount, totalTokens, gameOver }
 *   loss-chunk  { text }          — only on win; repeated
 *   loss-done   { text }          — only on win
 *   error       { error }         — on failure after SSE has started
 */
router.post('/', async (req: Request, res: Response) => {
  const { sessionId: providedSessionId, targetWordId, message } = req.body;

  // Input validation
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' });
  }
  const trimmed = message.trim();
  if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
    return res.status(400).json({
      error: `message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or fewer`,
    });
  }

  let release: (() => void) | undefined;
  const hold = (sessionId: string): void => {
    if (!sessionTurnGate.tryAcquire(sessionId)) {
      throw new HttpError(409, 'This game is already waiting on a reply.');
    }
    release = () => {
      sessionTurnGate.release(sessionId);
      release = undefined;
    };
  };

  let session;
  try {
    if (typeof providedSessionId === 'string' && SESSION_ID_PATTERN.test(providedSessionId)) {
      hold(providedSessionId);
    }
    session = await resolveSession(providedSessionId, targetWordId, trimmed);
    if (!release) hold(session.sessionId);
  } catch (err) {
    release?.();
    if (!(err instanceof HttpError)) console.error('Failed to resolve chat session:', err);
    return res.status(clientStatusCode(err)).json({
      error: clientErrorMessage(err, 'Failed to start this turn'),
    });
  }

  // Start SSE — send sessionId immediately so the client can persist it
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`event: meta\ndata: ${JSON.stringify({ sessionId: session.sessionId })}\n\n`);

  try {
    await runTurn(res, {
      sessionId:      session.sessionId,
      targetWord:     session.targetWord,
      sessionData:    session.sessionData,
      storedMessages: session.storedMessages,
      llmMessages:    session.llmMessages,
      userMessage:    trimmed,
      difficulty:     session.difficulty,
    });
  } catch (err) {
    if (!(err instanceof HttpError)) console.error('Chat turn failed:', err);
    const publicError = clientErrorMessage(err, 'The model could not complete this turn');
    res.write(`event: error\ndata: ${JSON.stringify({ error: publicError })}\n\n`);
  } finally {
    release?.();
    res.end();
  }
});

/**
 * POST /api/chat/abandon
 * Marks an unfinished session complete when the player resets.
 * Body: { sessionId: string }
 */
router.post('/abandon', async (req: Request, res: Response) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return res.status(400).json({ error: 'sessionId is invalid' });
  }
  try {
    await abandonSession(sessionId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error abandoning session:', err);
    res.status(500).json({ error: 'Failed to abandon session' });
  }
});

/**
 * POST /api/chat/decline
 * Records a decline. The conversation stays, and a later commit is refused.
 * Body: { sessionId: string }
 */
router.post('/decline', async (req: Request, res: Response) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return res.status(400).json({ error: 'sessionId is invalid' });
  }
  try {
    await declineSession(sessionId);
    res.json({ success: true });
  } catch (err) {
    if (!(err instanceof HttpError)) console.error('Error declining session:', err);
    res.status(clientStatusCode(err)).json({
      error: clientErrorMessage(err, 'Failed to decline this round'),
    });
  }
});

export default router;