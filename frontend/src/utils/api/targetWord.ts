/**
 * Target word API — fetch a random word for the current game session.
 */
import { apiClient } from './client';
import type { TargetWordResponse } from './types';

/**
 * Fetch a random target word from the backend.
 * @param difficulty  Optional filter — 'easy' | 'medium' | 'hard'
 */
export async function fetchTargetWord(
  difficulty?: 'easy' | 'medium' | 'hard'
): Promise<TargetWordResponse> {
  const query = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
  return apiClient.fetch<TargetWordResponse>(`/api/target-word${query}`);
}
