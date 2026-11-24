/**
 * Leaderboard service
 *
 * All database interactions for the leaderboard table live here.
 * Nothing in this file knows about HTTP or Express — that stays in the route.
 */
import pool from '../db/connection.js';
import { asDifficulty } from '../domain/difficulty.js';
import { parseStoredMessages } from '../domain/PlayerScore.js';
import { readStoredRound } from '../domain/StoredRound.js';
import { HttpError } from '../http/HttpError.js';
import { countTokens } from './llm.helpers.js';
import { MysqlLeaderboard, type BoardEntry, type BoardPage, type BoardPlace } from './MysqlLeaderboard.js';
import type { Difficulty } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { Difficulty };

export type LeaderboardEntry = BoardEntry;

export type RankResult = BoardPlace;

export interface SubmitResult {
  id: number;
  rank: number;
}

export interface LeaderboardStats {
  totalGames: number;
  averageTokens: number;
  bestScore: number;
  worstScore: number;
  popularWords: { target_word: string; count: number }[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export type LeaderboardPage = BoardPage;

/**
 * One page of one difficulty's board, best score first.
 * `limit` and `offset` are clamped inside the board module.
 */
export async function getEntries(
  limit: number,
  offset = 0,
  difficulty: Difficulty,
): Promise<LeaderboardPage> {
  return new MysqlLeaderboard(pool).page(difficulty, limit, offset);
}

/** The place a score would take on this difficulty right now. */
export async function getRank(tokenCount: number, difficulty: Difficulty): Promise<RankResult> {
  return new MysqlLeaderboard(pool).place(tokenCount, difficulty);
}

export interface SessionScoreResult extends SubmitResult {
  tokenCount: number;
  targetWord: string;
  difficulty: Difficulty;
}

/**
 * Record a win from the stored session. The client supplies a name and a
 * session id; token count, word, difficulty, and the winning reply are read
 * from the database inside a row lock.
 */
export async function submitSessionScore(
  playerName: string,
  sessionId: string,
): Promise<SessionScoreResult> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT target_word, difficulty AS session_difficulty, messages, completed, score_submitted, declined
         FROM game_sessions
        WHERE id = ?
        FOR UPDATE`,
      [sessionId],
    );
    const session = (rows as any[])[0];
    if (!session) throw new HttpError(404, 'Session not found');
    if (session.score_submitted) {
      throw new HttpError(409, 'Score already submitted for this session');
    }
    if (session.declined) throw new HttpError(409, 'This round was declined');
    if (session.completed) throw new HttpError(400, 'This round has ended');

    const messages = parseStoredMessages(session.messages).map((message) => {
      if (message.sender === 'user' && message.tokenCount == null) {
        return { ...message, tokenCount: countTokens(message.text) };
      }
      return message;
    });
    const targetWord = String(session.target_word);

    const [wordRows] = await connection.execute(
      'SELECT difficulty FROM target_words WHERE word = ? LIMIT 1',
      [targetWord],
    );
    const difficulty = asDifficulty((wordRows as { difficulty?: unknown }[])[0]?.difficulty)
      ?? asDifficulty(session.session_difficulty)
      ?? 'normal';

    const round = readStoredRound({
      targetWord,
      difficulty,
      messages,
      countTokens,
      declined: Boolean(session.declined),
      scoreSubmitted: Boolean(session.score_submitted),
      ended: Boolean(session.completed),
    });
    if (!round.canCommit || round.score === null || round.winningReply === null) {
      throw new HttpError(400, 'This session has no recorded win');
    }
    const tokenCount = round.score;
    const victoryMessage = round.winningReply;

    const [result] = await connection.execute(
      `INSERT INTO leaderboard
         (player_name, token_count, target_word, difficulty, llm_victory_message, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [playerName, tokenCount, targetWord, difficulty, victoryMessage, sessionId],
    );
    const id = Number((result as { insertId?: number }).insertId);

    await connection.execute(
      'UPDATE game_sessions SET score_submitted = TRUE, difficulty = ? WHERE id = ?',
      [difficulty, sessionId],
    );

    const { rank } = await new MysqlLeaderboard(connection).place(tokenCount, difficulty);

    await connection.commit();
    recordWordWin(targetWord, tokenCount);
    return { id, rank, tokenCount, targetWord, difficulty };
  } catch (error) {
    await connection.rollback();
    const code = (error as { code?: string }).code;
    if (code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Score already submitted for this session');
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Win counters are statistics, not part of the score insert.
 * `win_count` is assigned last so the average still sees the previous count.
 * MySQL evaluates a single-table SET list from left to right.
 */
function recordWordWin(targetWord: string, tokenCount: number): void {
  pool.execute(
    `UPDATE target_words
        SET avg_tokens_to_win = CASE
              WHEN win_count = 0 OR avg_tokens_to_win IS NULL THEN ?
              ELSE (avg_tokens_to_win * win_count + ?) / (win_count + 1)
            END,
            max_tokens_to_win = GREATEST(COALESCE(max_tokens_to_win, 0), ?),
            min_tokens_to_win = LEAST(COALESCE(min_tokens_to_win, ?), ?),
            win_count = win_count + 1
      WHERE word = ?`,
    [tokenCount, tokenCount, tokenCount, tokenCount, tokenCount, targetWord],
  ).catch((err) => console.warn('Could not update word win stats:', err));
}

/**
 * Return aggregate statistics for the leaderboard.
 */
export async function getStats(difficulty: Difficulty): Promise<LeaderboardStats> {
  const where = ' WHERE difficulty = ?';
  const params = [difficulty];
  const [[statsRows], [wordRows]] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*)        AS total_games,
        AVG(token_count) AS avg_tokens,
        MIN(token_count) AS best_score,
        MAX(token_count) AS worst_score
      FROM leaderboard${where}
    `, [...params]),
    pool.execute(`
      SELECT target_word, COUNT(*) AS count
      FROM leaderboard${where}
      GROUP BY target_word
      ORDER BY count DESC
      LIMIT 5
    `, [...params]),
  ]);

  const s = (statsRows as any[])[0]!;
  return {
    totalGames:    s.total_games    as number,
    averageTokens: Math.round(s.avg_tokens  ?? 0),
    bestScore:     s.best_score     ?? 0,
    worstScore:    s.worst_score    ?? 0,
    popularWords:  wordRows as { target_word: string; count: number }[],
  };
}
