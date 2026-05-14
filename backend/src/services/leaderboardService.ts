/**
 * Leaderboard service
 *
 * All database interactions for the leaderboard table live here.
 * Nothing in this file knows about HTTP or Express — that stays in the route.
 */
import pool from '../db/connection.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: number;
  player_name: string;
  token_count: number;
  target_word: string;
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
 * Fetch the top N leaderboard entries, optionally filtered by target word.
 * `limit` must already be a validated integer in [1, 100].
 */
export async function getEntries(
  limit: number,
  targetWord?: string,
): Promise<LeaderboardEntry[]> {
  let query = `
    SELECT id, player_name, token_count, target_word, completed_at, session_id
    FROM leaderboard
  `;
  const params: unknown[] = [];

  if (targetWord) {
    query += ' WHERE target_word = ?';
    params.push(targetWord);
  }

  // LIMIT is inlined as a safe integer (clamped 1–100 by the caller) because
  // mysql2 prepared statements do not reliably handle numeric LIMIT params.
  query += ` ORDER BY token_count ASC, completed_at ASC LIMIT ${limit}`;

  const [rows] = await pool.execute(query, params);
  return rows as LeaderboardEntry[];
}

/**
 * Calculate the rank and percentile a given token count would achieve.
 */
export async function getRank(tokenCount: number): Promise<RankResult> {
  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM leaderboard WHERE token_count <= ?) AS better_or_equal,
       (SELECT COUNT(*) FROM leaderboard)                         AS total`,
    [tokenCount],
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
 * Returns true if the session exists and `score_submitted` is truthy.
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
 * Returns the new row's id and achieved rank.
 */
export async function submitEntry(
  playerName: string,
  tokenCount: number,
  targetWord: string,
  sessionId: string | null,
): Promise<SubmitResult> {
  const [result] = await pool.execute(
    'INSERT INTO leaderboard (player_name, token_count, target_word, session_id) VALUES (?, ?, ?, ?)',
    [playerName, tokenCount, targetWord, sessionId],
  );
  const insertId = (result as any).insertId as number;

  if (sessionId) {
    await pool.execute(
      'UPDATE game_sessions SET score_submitted = TRUE WHERE id = ?',
      [sessionId],
    );
  }

  // Rank = entries with a strictly lower token count + 1.
  // Ties favour earlier submissions (lower id), so this entry correctly
  // beats same-count entries inserted after it.
  const [rankRows] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM leaderboard WHERE token_count < ?) + 1 AS \`rank\``,
    [tokenCount],
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
