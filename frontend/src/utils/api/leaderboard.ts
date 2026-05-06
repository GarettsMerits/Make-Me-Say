/**
 * Leaderboard API — scores, ranks, and statistics.
 */
import { apiClient } from './client';
import type {
  LeaderboardResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
  LeaderboardStats,
} from './types';

/**
 * Calculate the rank a given token count would achieve on the leaderboard.
 * Returns a 1-based rank (1 = best / fewest tokens).
 */
export async function fetchLeaderboardRank(tokenCount: number): Promise<number> {
  const data = await apiClient.fetch<{ rank: number }>(
    `/api/leaderboard/rank/${encodeURIComponent(tokenCount)}`
  );
  return data.rank;
}

/**
 * Fetch the top scores from the leaderboard.
 * @param limit  Max number of results to return (default: 10).
 */
export async function fetchLeaderboard(limit = 10): Promise<LeaderboardResponse> {
  return apiClient.fetch<LeaderboardResponse>(
    `/api/leaderboard?limit=${encodeURIComponent(limit)}`
  );
}

/**
 * Submit a winning score to the leaderboard.
 * Throws with message `'Score already submitted for this session'` (HTTP 409)
 * if the session has already been scored — callers should surface this to the user.
 */
export async function submitScore(
  request: SubmitScoreRequest
): Promise<SubmitScoreResponse> {
  return apiClient.fetch<SubmitScoreResponse>('/api/leaderboard', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Fetch aggregate leaderboard statistics (total games, averages, popular words, etc.).
 */
export async function fetchLeaderboardStats(): Promise<LeaderboardStats> {
  return apiClient.fetch<LeaderboardStats>('/api/leaderboard/stats');
}
