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
import { asDifficulty } from '../domain/difficulty.js';
import { InMemoryLeaderboard } from '../domain/InMemoryLeaderboard.js';
import { parseStoredMessages, type ScoredMessage } from '../domain/PlayerScore.js';
import { roundForTranscript } from '../domain/Round.js';
import { HttpError } from '../http/HttpError.js';
import type { Difficulty } from '../types.js';
import { countTokens } from './llm.helpers.js';
import type { ChatMessage } from '../services/llm.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  target_word: string;
  difficulty?: Difficulty | string | null;
  current_tokens: number;
  messages: ScoredMessage[] | string;
  completed: boolean;
  declined?: boolean;
  created_at: string;
  last_activity: string;
}

export interface ResolvedSession {
  sessionId: string;
  targetWord: string;
  /** null on the very first exchange (no DB row yet) */
  sessionData: SessionRow | null;
  storedMessages: ScoredMessage[];
  llmMessages: ChatMessage[];
  difficulty: Difficulty;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Prefer the word list over the session column. Older rows defaulted to normal. */
async function difficultyForWord(word: string, stored: unknown): Promise<Difficulty> {
  const [rows] = await pool.execute(
    'SELECT difficulty FROM target_words WHERE word = ? LIMIT 1',
    [word],
  );
  const fromList = asDifficulty((rows as { difficulty?: unknown }[])[0]?.difficulty);
  return fromList ?? asDifficulty(stored) ?? 'normal';
}

/** Convert stored messages + the current user turn into the ChatMessage format. */
function buildLlmMessages(stored: ScoredMessage[], userMessage: string): ChatMessage[] {
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
 * Throws HttpError so the route can forward a client-safe status.
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
      throw new HttpError(400, 'targetWordId is required when starting a new session');
    }

    const [wordRows] = await pool.execute(
      'SELECT word, difficulty FROM target_words WHERE id = ? AND is_active = TRUE',
      [targetWordId],
    );
    const wordResults = wordRows as { word: string; difficulty: unknown }[];
    if (wordResults.length === 0) {
      throw new HttpError(400, 'Invalid targetWordId');
    }

    const targetWord = wordResults[0]!.word;
    const storedMessages: ScoredMessage[] = [];
    return {
      sessionId,
      targetWord,
      sessionData: null,
      storedMessages,
      llmMessages: buildLlmMessages(storedMessages, userMessage),
      difficulty: asDifficulty(wordResults[0]!.difficulty) ?? 'normal',
    };
  }

  // Existing session
  const [sessionRows] = await pool.execute(
    'SELECT * FROM game_sessions WHERE id = ?',
    [providedSessionId],
  );
  const sessions = sessionRows as SessionRow[];

  if (sessions.length === 0) {
    throw new HttpError(404, 'Session not found. Start a new game.');
  }

  const sessionData: SessionRow = sessions[0]!;

  if (sessionData.declined) {
    throw new HttpError(409, 'This round was declined.');
  }

  if (sessionData.completed) {
    throw new HttpError(409, 'This game session is already complete.');
  }

  const storedMessages = parseStoredMessages(sessionData.messages);
  const difficulty = await difficultyForWord(sessionData.target_word, sessionData.difficulty);
  const round = roundForTranscript({
    targetWord: sessionData.target_word,
    difficulty,
    messages: storedMessages,
    leaderboard: new InMemoryLeaderboard(),
    countTokens,
  });
  if (round.scoreLocked()) {
    throw new HttpError(409, 'This round is already won.');
  }

  return {
    sessionId: providedSessionId!,
    targetWord: sessionData.target_word,
    sessionData,
    storedMessages,
    llmMessages: buildLlmMessages(storedMessages, userMessage),
    difficulty,
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
  storedMessages: ScoredMessage[],
  userMessage: string,
  userTokens: number,
  llmResponse: string,
  llmTokens: number,
  completed: boolean,
  difficulty: Difficulty,
): Promise<number> {
  const exchangeTokens = userTokens + llmTokens;
  const updatedMessages: ScoredMessage[] = [
    ...storedMessages,
    { sender: 'user', text: userMessage,   tokenCount: userTokens },
    { sender: 'llm',  text: llmResponse,   tokenCount: llmTokens  },
  ];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let totalTokens: number;
    if (sessionData) {
      totalTokens = sessionData.current_tokens + exchangeTokens;
      const [result] = await connection.execute(
        `UPDATE game_sessions
            SET current_tokens = ?, messages = ?, completed = ?, difficulty = ?, last_activity = CURRENT_TIMESTAMP
          WHERE id = ? AND current_tokens = ?`,
        [
          totalTokens,
          JSON.stringify(updatedMessages),
          completed,
          difficulty,
          sessionId,
          sessionData.current_tokens,
        ],
      );
      if (Number((result as { affectedRows?: number }).affectedRows ?? 0) === 0) {
        throw new HttpError(409, 'This game changed before the reply could be saved. Reload and try again.');
      }
    } else {
      totalTokens = exchangeTokens;
      await connection.execute(
        `INSERT INTO game_sessions (id, target_word, difficulty, current_tokens, messages, completed)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, targetWord, difficulty, totalTokens, JSON.stringify(updatedMessages), completed],
      );
      await connection.execute(
        'UPDATE target_words SET total_games_played = total_games_played + 1 WHERE word = ?',
        [targetWord],
      );
    }

    await connection.commit();
    return totalTokens;
  } catch (dbError) {
    await connection.rollback();
    if (dbError instanceof HttpError) throw dbError;
    console.error('Could not persist session to database:', dbError);
    throw new HttpError(503, 'This turn could not be saved. Send it again.');
  } finally {
    connection.release();
  }
}

/**
 * Close an in-progress session so a later turn cannot continue it.
 * A finished or already-submitted session is left unchanged.
 */
export async function abandonSession(sessionId: string): Promise<void> {
  await pool.execute(
    `UPDATE game_sessions
        SET completed = TRUE, last_activity = CURRENT_TIMESTAMP
      WHERE id = ? AND completed = FALSE AND score_submitted = FALSE`,
    [sessionId],
  );
}

/**
 * Record a decline. The conversation stays, and the score cannot be committed later.
 * Reset still ends the round; this does not.
 */
export async function declineSession(sessionId: string): Promise<void> {
  const [rows] = await pool.execute(
    'SELECT declined, score_submitted, completed FROM game_sessions WHERE id = ?',
    [sessionId],
  );
  const session = (rows as Array<{
    declined?: number | boolean;
    score_submitted?: number | boolean;
    completed?: number | boolean;
  }>)[0];
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.score_submitted) throw new HttpError(409, 'Score already submitted for this session');
  if (session.completed) throw new HttpError(400, 'This round has ended');
  if (session.declined) return;

  await pool.execute(
    `UPDATE game_sessions
        SET declined = TRUE
      WHERE id = ? AND score_submitted = FALSE AND completed = FALSE`,
    [sessionId],
  );
}

