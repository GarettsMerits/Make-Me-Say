/**
 * Chat endpoint router.
 * Handles chat messages, LLM interactions, and game session tracking.
 *
 * SECURITY MODEL:
 * - The client never supplies the target word or conversation history.
 * - On the first message the client sends a `targetWordId` (numeric DB PK).
 *   The server resolves the actual word string from the database, so the
 *   client cannot forge or substitute a different target word.
 * - On subsequent messages the client sends only `sessionId` + `message`.
 *   The server reads the target word and full message history from the
 *   DB session row — the client cannot tamper with either.
 */
import express from 'express';
import type { Request, Response } from 'express';
import pool from '../db/connection.js';
import { streamChatCompletion, countTokens, type ChatMessage } from '../services/llm.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Developer cheat-mode configuration.
 * Read lazily on first request rather than at module load so that dotenv has
 * already populated process.env by the time these values are consumed.
 */
function getCheatConfig(): { enabled: boolean; trigger: string } {
  return {
    enabled: (process.env.ENABLE_CHEAT_MODE ?? '').toLowerCase() === 'true',
    trigger: (process.env.CHEAT_TRIGGER ?? 'philliburton').toLowerCase(),
  };
}

// Log once on the first request that actually checks cheat config
let _cheatLogged = false;

/** Safely extract a message string from an unknown catch value. */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * POST /api/chat
 * Process a user message and get an LLM response.
 *
 * First message  → send { targetWordId: number, message: string }
 * Later messages → send { sessionId: string,    message: string }
 *
 * Response:
 * - sessionId          Session identifier (echo back / newly created)
 * - response           LLM's reply text
 * - tokenCount         Tokens used by this exchange
 * - totalTokens        Running total for the session
 * - gameOver           true when the LLM said the target word
 * - targetWordDetected alias for gameOver
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId: providedSessionId, targetWordId, message } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required and must be a non-empty string' });
    }

    const isNewSession = !providedSessionId;

    if (isNewSession && (targetWordId === undefined || targetWordId === null)) {
      return res.status(400).json({
        error: 'targetWordId is required when starting a new session',
      });
    }

    // ── Resolve target word & history from the database ───────────────────────
    let targetWord: string;
    let sessionData: any = null;
    const sessionId: string = providedSessionId || uuidv4();

    if (isNewSession) {
      // Fetch the real word by ID — the client cannot supply or alter the word string
      const [wordRows] = await pool.execute(
        'SELECT word FROM target_words WHERE id = ? AND is_active = TRUE',
        [targetWordId]
      );
      const wordResults = wordRows as any[];
      if (wordResults.length === 0) {
        return res.status(400).json({ error: 'Invalid targetWordId' });
      }
      targetWord = wordResults[0].word;
    } else {
      // Load the session — targetWord and history come from the DB, not the client
      const [sessionRows] = await pool.execute(
        'SELECT * FROM game_sessions WHERE id = ?',
        [sessionId]
      );
      const sessions = sessionRows as any[];
      if (sessions.length === 0) {
        return res.status(404).json({ error: 'Session not found. Start a new game.' });
      }
      sessionData = sessions[0];
      targetWord = sessionData.target_word;

      if (sessionData.completed) {
        return res.status(409).json({ error: 'This game session is already complete.' });
      }
    }

    // ── Reconstruct conversation history from stored session ──────────────────
    // mysql2 may automatically deserialise JSON columns into a JS array, so
    // guard against calling JSON.parse on something that is already an array.
    const storedMessages: { sender: 'user' | 'llm'; text: string }[] = sessionData
      ? Array.isArray(sessionData.messages)
        ? sessionData.messages
        : JSON.parse(sessionData.messages || '[]')
      : [];

    const llmMessages: ChatMessage[] = [
      ...storedMessages.map((msg) => ({
        role: msg.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.text,
      })),
      { role: 'user' as const, content: message.trim() },
    ];

    // ── Cheat mode (dev only) ──────────────────────────────────────────────────
    // If ENABLE_CHEAT_MODE=true in .env and the player's message contains the
    // trigger word, swap to the cheat prompt that forces the LLM to say the
    // target word immediately.
    const { enabled: cheatEnabled, trigger: cheatTrigger } = getCheatConfig();
    if (cheatEnabled && !_cheatLogged) {
      console.warn(`[dev] Cheat mode ENABLED — trigger word: "${cheatTrigger}"`);
      _cheatLogged = true;
    }
    const cheatMode = cheatEnabled && message.toLowerCase().includes(cheatTrigger);

    // ── Set up SSE ────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Send sessionId immediately so the client can persist it before chunks arrive
    res.write(`event: meta\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    // ── Stream LLM response ───────────────────────────────────────────────────
    let llmResponse = '';
    try {
      for await (const chunk of streamChatCompletion({
        targetWord,
        messages: llmMessages,
        maxTokens: 500,
        temperature: 0.7,
        cheatMode,
      })) {
        llmResponse += chunk;
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    } catch (streamError) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: getErrorMessage(streamError) })}\n\n`);
      res.end();
      return;
    }

    // ── Persist session ───────────────────────────────────────────────────────
    // Whole-word check, matching the logic in llm.ts
    const wordRegex = new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const didSayWord = wordRegex.test(llmResponse);
    const userTokens = countTokens(message.trim());
    const tokenCount = countTokens(llmResponse);
    const exchangeTokens = tokenCount + userTokens;

    const updatedMessages = [
      ...storedMessages,
      { sender: 'user', text: message.trim(), tokenCount: userTokens },
      { sender: 'llm',  text: llmResponse,    tokenCount },
    ];

    let totalTokens: number;
    try {
      if (sessionData) {
        totalTokens = sessionData.current_tokens + exchangeTokens;
        await pool.execute(
          'UPDATE game_sessions SET current_tokens = ?, messages = ?, completed = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
          [totalTokens, JSON.stringify(updatedMessages), didSayWord, sessionId]
        );
      } else {
        totalTokens = exchangeTokens;
        await pool.execute(
          'INSERT INTO game_sessions (id, target_word, current_tokens, messages, completed) VALUES (?, ?, ?, ?, ?)',
          [sessionId, targetWord, totalTokens, JSON.stringify(updatedMessages), didSayWord]
        );
      }
    } catch (dbError) {
      console.warn('Could not persist session to database:', dbError);
      totalTokens = (sessionData?.current_tokens ?? 0) + exchangeTokens;
    }

    // ── Send completion event ──────────────────────────────────────────────────
    res.write(`event: done\ndata: ${JSON.stringify({ sessionId, tokenCount, totalTokens, gameOver: didSayWord, targetWordDetected: didSayWord })}\n\n`);

    // ── Loss acknowledgement (win detected) ───────────────────────────────────
    // When the player wins, stream a second LLM message using the loss prompt
    // so the LLM can react to its own defeat before the victory bar appears.
    if (didSayWord) {
      const lossHistory: ChatMessage[] = [
        ...llmMessages,
        { role: 'assistant' as const, content: llmResponse },
      ];
      let lossResponse = '';
      try {
        for await (const chunk of streamChatCompletion({
          targetWord,
          messages: lossHistory,
          maxTokens: 300,
          temperature: 0.9,
          lossMode: true,
        })) {
          lossResponse += chunk;
          res.write(`event: loss-chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
        }
      } catch {
        // Loss stream failure is non-fatal — the win is already recorded
      }
      res.write(`event: loss-done\ndata: ${JSON.stringify({ text: lossResponse })}\n\n`);
    }

    res.end();

  } catch (error: unknown) {
    console.error('Chat endpoint error:', getErrorMessage(error));
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to process chat message',
        message: getErrorMessage(error),
      });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: getErrorMessage(error) })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/chat/session/:sessionId
 * Retrieve a game session by ID
 * 
 * Response:
 * - sessionId: Session identifier
 * - targetWord: The target word for this session
 * - messages: Array of conversation messages
 * - totalTokens: Total tokens used
 * - completed: Whether the game is over
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const [rows] = await pool.execute(
      'SELECT * FROM game_sessions WHERE id = ?',
      [sessionId]
    );
    
    const sessions = rows as any[];
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessions[0];
    
    res.json({
      sessionId: session.id,
      targetWord: session.target_word,
      messages: Array.isArray(session.messages) ? session.messages : JSON.parse(session.messages || '[]'),
      totalTokens: session.current_tokens,
      completed: session.completed,
      createdAt: session.created_at,
      lastActivity: session.last_activity
    });
    
  } catch (error: unknown) {
    console.error('Error fetching session:', error);
    res.status(500).json({ 
      error: 'Failed to fetch session',
      message: getErrorMessage(error),
    });
  }
});

export default router;
