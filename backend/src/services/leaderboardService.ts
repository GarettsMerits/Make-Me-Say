/**
 * Leaderboard service
 *
 * All database interactions for the leaderboard table live here.
 * Nothing in this file knows about HTTP or Express — that stays in the route.
 */
import pool from '../db/connection.js';
import { asDifficulty } from '../domain/difficulty.js';
import { LeaderboardRank } from '../domain/LeaderboardRank.js';
import { parseStoredMessages } from '../domain/PlayerScore.js';
import { readStoredRound } from '../domain/StoredRound.js';
import { HttpError } from '../http/HttpError.js';
import { countTokens } from './llm.helpers.js';
import type { Difficulty } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { Difficulty };

export interface LeaderboardEntry {
  id: number;
  player_name: string;
  token_count: number;
  target_word: string;
  difficulty: Difficulty;
  llm_victory_message: string | null;
  completed_at: string;
  session_id: string | null;
  /** Live place on this difficulty. Equal scores share it. */
  rank?: number;
}

export interface RankResult {
  rank: number;
  total: number;
}

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

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  hasMore: boolean;
}

const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10_000;

/**
 * One page of leaderboard rows, best score first.
 * `limit` and `offset` are clamped and inlined as integers.
 * Fetches one extra row to report whether another page exists.
 */
export async function getEntries(
  limit: number,
  offset = 0,
  difficulty: Difficulty,
): Promise<LeaderboardPage> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), MAX_PAGE_SIZE));
  const safeOffset = Math.max(0, Math.min(Math.trunc(offset), MAX_OFFSET));

  const [rows] = await pool.execute(
    `SELECT l.id, l.player_name, l.token_count, l.target_word, l.difficulty,
            l.llm_victory_message, l.completed_at, l.session_id,
            (SELECT COUNT(*) FROM leaderboard AS better
              WHERE better.difficulty = l.difficulty
                AND better.token_count < l.token_count) + 1 AS entry_rank
       FROM leaderboard AS l
      WHERE l.difficulty = ?
      ORDER BY l.token_count ASC, l.completed_at ASC
      LIMIT ${safeLimit + 1} OFFSET ${safeOffset}`,
    [difficulty],
  );
  const found = (rows as Array<LeaderboardEntry & { entry_rank: number }>).map((row) => {
    const { entry_rank, ...entry } = row;
    return { ...entry, rank: Number(entry_rank) };
  });
  const hasMore = found.length > safeLimit && safeOffset < MAX_OFFSET;
  return { entries: found.slice(0, safeLimit), hasMore };
}

/**
 * Calculate the place a given token count would take on one difficulty.
 */
export async function getRank(tokenCount: number, difficulty: Difficulty): Promise<RankResult> {
  const difficultyClause = ' AND difficulty = ?';
  const params: unknown[] = [tokenCount, difficulty, difficulty];

  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM leaderboard WHERE token_count < ?${difficultyClause}) AS better,
       (SELECT COUNT(*) FROM leaderboard${difficulty ? ' WHERE difficulty = ?' : ''}) AS total`,
    params,
  );
  const row = (rows as any[])[0]!;
  const ranked = new LeaderboardRank(Number(row.better ?? 0));
  return {
    rank: ranked.place,
    total: Number(row.total ?? 0),
  };
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

    const [rankRows] = await connection.execute(
      `SELECT COUNT(*) AS better
         FROM leaderboard
        WHERE token_count < ? AND difficulty = ?`,
      [tokenCount, difficulty],
    );
    const rank = new LeaderboardRank(Number((rankRows as any[])[0]?.better ?? 0)).place;

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
