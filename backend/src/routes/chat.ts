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
import { resolveSession, getSessionById } from '../services/sessionService.js';
import { runTurn } from '../services/chatOrchestrator.js';

const router = express.Router();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

  let session;
  try {
    session = await resolveSession(providedSessionId, targetWordId, message.trim());
  } catch (err) {
    const status = (err as any).statusCode ?? 500;
    return res.status(status).json({ error: getErrorMessage(err) });
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
      userMessage:    message.trim(),
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: getErrorMessage(err) })}\n\n`);
  }

  res.end();
});

// ─── GET /api/chat/session/:sessionId ────────────────────────────────────────

router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await getSessionById(req.params.sessionId!);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).json({ error: 'Failed to fetch session', message: getErrorMessage(err) });
  }
});

export default router;