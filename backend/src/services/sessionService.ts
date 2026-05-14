/**
 * Session service
 *
 * Owns all database interactions for game_sessions:
 *   - Resolving a target word from an ID (new sessions)
 *   - Loading an existing session row
 *   - Persisting session state after each exchange
 *
 * Nothing in here knows about HTTP, SSE, or LLM streaming.
 */
import pool from '../db/connection.js';
import type { ChatMessage } from '../services/llm.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredMessage {
  sender: 'user' | 'llm';
  text: string;
  tokenCount?: number;
}

export interface SessionRow {
  id: string;
  target_word: string;
  current_tokens: number;
  messages: StoredMessage[] | string;
  completed: boolean;
  created_at: string;
  last_activity: string;
}

export interface ResolvedSession {
  sessionId: string;
  targetWord: string;
  /** null on the very first exchange (no DB row yet) */
  sessionData: SessionRow | null;
  storedMessages: StoredMessage[];
  llmMessages: ChatMessage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** mysql2 may auto-parse JSON columns; guard against double-parsing. */
function parseMessages(raw: StoredMessage[] | string): StoredMessage[] {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

/** Convert stored messages + the current user turn into the ChatMessage format. */
function buildLlmMessages(stored: StoredMessage[], userMessage: string): ChatMessage[] {
  return [
    ...stored.map((m): ChatMessage => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    })),
    { role: 'user', content: userMessage },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a target word and load/initialise session state from the DB.
 *
 * Throws with a `statusCode` property so the route can forward the right
 * HTTP status without knowing DB internals.
 */
export async function resolveSession(
  providedSessionId: string | undefined,
  targetWordId: number | undefined,
  userMessage: string,
): Promise<ResolvedSession> {
  const isNewSession = !providedSessionId;
  const sessionId    = providedSessionId ?? crypto.randomUUID();

  if (isNewSession) {
    if (targetWordId == null) {
      const err = Object.assign(new Error('targetWordId is required when starting a new session'), { statusCode: 400 });
      throw err;
    }

    const [wordRows] = await pool.execute(
      'SELECT word FROM target_words WHERE id = ? AND is_active = TRUE',
      [targetWordId],
    );
    const wordResults = wordRows as { word: string }[];
    if (wordResults.length === 0) {
      throw Object.assign(new Error('Invalid targetWordId'), { statusCode: 400 });
    }

    const targetWord = wordResults[0]!.word;
    const storedMessages: StoredMessage[] = [];
    return {
      sessionId,
      targetWord,
      sessionData: null,
      storedMessages,
      llmMessages: buildLlmMessages(storedMessages, userMessage),
    };
  }

  // Existing session
  const [sessionRows] = await pool.execute(
    'SELECT * FROM game_sessions WHERE id = ?',
    [providedSessionId],
  );
  const sessions = sessionRows as SessionRow[];

  if (sessions.length === 0) {
    throw Object.assign(new Error('Session not found. Start a new game.'), { statusCode: 404 });
  }

  const sessionData: SessionRow = sessions[0]!;

  if (sessionData.completed) {
    throw Object.assign(new Error('This game session is already complete.'), { statusCode: 409 });
  }

  const storedMessages = parseMessages(sessionData.messages);
  return {
    sessionId: providedSessionId!,
    targetWord: sessionData.target_word,
    sessionData,
    storedMessages,
    llmMessages: buildLlmMessages(storedMessages, userMessage),
  };
}

/**
 * Persist the result of one exchange.
 * Returns the updated running token total.
 */
export async function persistExchange(
  sessionId: string,
  targetWord: string,
  sessionData: SessionRow | null,
  storedMessages: StoredMessage[],
  userMessage: string,
  userTokens: number,
  llmResponse: string,
  llmTokens: number,
  completed: boolean,
): Promise<number> {
  const exchangeTokens = userTokens + llmTokens;
  const updatedMessages: StoredMessage[] = [
    ...storedMessages,
    { sender: 'user', text: userMessage,   tokenCount: userTokens },
    { sender: 'llm',  text: llmResponse,   tokenCount: llmTokens  },
  ];

  let totalTokens: number;
  try {
    if (sessionData) {
      totalTokens = sessionData.current_tokens + exchangeTokens;
      await pool.execute(
        `UPDATE game_sessions
            SET current_tokens = ?, messages = ?, completed = ?, last_activity = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [totalTokens, JSON.stringify(updatedMessages), completed, sessionId],
      );
    } else {
      totalTokens = exchangeTokens;
      await pool.execute(
        `INSERT INTO game_sessions (id, target_word, current_tokens, messages, completed)
          VALUES (?, ?, ?, ?, ?)`,
        [sessionId, targetWord, totalTokens, JSON.stringify(updatedMessages), completed],
      );
    }
  } catch (dbError) {
    console.warn('Could not persist session to database:', dbError);
    totalTokens = (sessionData?.current_tokens ?? 0) + exchangeTokens;
  }

  return totalTokens;
}

/**
 * Fetch the player's prospective rank and the total leaderboard size for a
 * given token count.  Returns safe defaults on failure so the loss prompt
 * always has something sensible to say.
 */
export async function fetchRankContext(
  tokenCount: number,
): Promise<{ rank: number; total: number }> {
  try {
    const [rows] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM leaderboard WHERE token_count <= ?) AS better_or_equal,
         (SELECT COUNT(*) FROM leaderboard)                         AS total`,
      [tokenCount],
    );
    const row = (rows as any[])[0];
    return {
      rank:  (row.better_or_equal ?? 0) + 1,
      total: row.total ?? 1,
    };
  } catch {
    return { rank: 1, total: 1 };
  }
}

/**
 * Return a session row as a clean JSON-serialisable object.
 */
export async function getSessionById(sessionId: string): Promise<{
  sessionId: string;
  targetWord: string;
  messages: StoredMessage[];
  totalTokens: number;
  completed: boolean;
  createdAt: string;
  lastActivity: string;
} | null> {
  const [rows] = await pool.execute('SELECT * FROM game_sessions WHERE id = ?', [sessionId]);
  const sessions = rows as SessionRow[];
  if (sessions.length === 0) return null;

  const s = sessions[0]!;
  return {
    sessionId:    s.id,
    targetWord:   s.target_word,
    messages:     parseMessages(s.messages),
    totalTokens:  s.current_tokens,
    completed:    s.completed,
    createdAt:    s.created_at,
    lastActivity: s.last_activity,
  };
}
