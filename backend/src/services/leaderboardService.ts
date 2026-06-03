/**
 * Leaderboard service
 *
 * All database interactions for the leaderboard table live here.
 * Nothing in this file knows about HTTP or Express — that stays in the route.
 */
import pool from '../db/connection.js';
import { type Difficulty } from '../types.js';

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
}

export interface RankResult {
  rank: number;
  total: number;
  percentile: number;
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

/**
 * Fetch the top N leaderboard entries, optionally filtered by difficulty.
 * `limit` must already be a validated integer in [1, 100].
 */
export async function getEntries(
  limit: number,
  difficulty?: Difficulty,
): Promise<LeaderboardEntry[]> {
  // Clamp to a safe integer so it can be interpolated without injection risk
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));

  let query = `
    SELECT id, player_name, token_count, target_word, difficulty, llm_victory_message, completed_at, session_id
    FROM leaderboard
  `;
  const params: unknown[] = [];

  if (difficulty) {
    query += ' WHERE difficulty = ?';
    params.push(difficulty);
  }

  query += ` ORDER BY token_count ASC, completed_at ASC LIMIT ${safeLimit}`;

  const [rows] = await pool.execute(query, params);
  return rows as LeaderboardEntry[];
}

/**
 * Calculate the rank and percentile a given token count would achieve,
 * optionally scoped to a specific difficulty.
 */
export async function getRank(tokenCount: number, difficulty?: Difficulty): Promise<RankResult> {
  const difficultyClause = difficulty ? ' AND difficulty = ?' : '';
  const params: unknown[] = difficulty
    ? [tokenCount, difficulty, difficulty]
    : [tokenCount];

  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM leaderboard WHERE token_count <= ?${difficultyClause}) AS better_or_equal,
       (SELECT COUNT(*) FROM leaderboard${difficulty ? ' WHERE difficulty = ?' : ''}) AS total`,
    params,
  );
  const row = (rows as any[])[0]!;
  const rank  = (row.better_or_equal as number) + 1;
  const total = row.total as number;
  return {
    rank,
    total,
    percentile: total > 0 ? Math.round((1 - rank / total) * 100) : 0,
  };
}

/**
 * Check whether a session's score has already been submitted.
 */
export async function isScoreAlreadySubmitted(sessionId: string): Promise<boolean> {
  const [rows] = await pool.execute(
    'SELECT score_submitted FROM game_sessions WHERE id = ?',
    [sessionId],
  );
  const session = (rows as any[])[0];
  return Boolean(session?.score_submitted);
}

/**
 * Insert a leaderboard entry and mark the session as scored.
 * Also updates the target word's win statistics.
 * Returns the new row's id and achieved rank (within the same difficulty).
 */
export async function submitEntry(
  playerName: string,
  tokenCount: number,
  targetWord: string,
  difficulty: Difficulty,
  llmVictoryMessage: string | null,
  sessionId: string | null,
): Promise<SubmitResult> {
  const [result] = await pool.execute(
    `INSERT INTO leaderboard (player_name, token_count, target_word, difficulty, llm_victory_message, session_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [playerName, tokenCount, targetWord, difficulty, llmVictoryMessage, sessionId],
  );
  const insertId = (result as any).insertId as number;

  if (sessionId) {
    await pool.execute(
      'UPDATE game_sessions SET score_submitted = TRUE WHERE id = ?',
      [sessionId],
    );
  }

  // Update word win statistics
  pool.execute(
    `UPDATE target_words
     SET
       win_count         = win_count + 1,
       avg_tokens_to_win = CASE
         WHEN avg_tokens_to_win IS NULL THEN ?
         ELSE (avg_tokens_to_win * win_count + ?) / (win_count + 1)
       END,
       max_tokens_to_win = GREATEST(COALESCE(max_tokens_to_win, 0), ?),
       min_tokens_to_win = LEAST(COALESCE(min_tokens_to_win, ?), ?)
     WHERE word = ?`,
    [tokenCount, tokenCount, tokenCount, tokenCount, tokenCount, targetWord],
  ).catch((err) => console.warn('Could not update word win stats:', err));

  // Rank = entries with a strictly lower token count within same difficulty + 1
  const [rankRows] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM leaderboard WHERE token_count < ? AND difficulty = ?) + 1 AS \`rank\``,
    [tokenCount, difficulty],
  );
  const rank = (rankRows as any[])[0]!.rank as number;

  return { id: insertId, rank };
}

/**
 * Return aggregate statistics for the leaderboard.
 */
export async function getStats(): Promise<LeaderboardStats> {
  const [[statsRows], [wordRows]] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*)        AS total_games,
        AVG(token_count) AS avg_tokens,
        MIN(token_count) AS best_score,
        MAX(token_count) AS worst_score
      FROM leaderboard
    `),
    pool.execute(`
      SELECT target_word, COUNT(*) AS count
      FROM leaderboard
      GROUP BY target_word
      ORDER BY count DESC
      LIMIT 5
    `),
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
