/**
 * Target word API — fetch a random word for the current game session.
 */
import { apiClient } from './client';
import type { Difficulty, TargetWordResponse } from './types';

/**
 * Fetch a random target word from the backend.
 * @param difficulty  Optional filter — 'easy' | 'normal' | 'hard' | 'nightmare'
 */
export async function fetchTargetWord(
  difficulty?: Difficulty
): Promise<TargetWordResponse> {
  const query = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
  return apiClient.fetch<TargetWordResponse>(`/api/target-word${query}`);
}

/**
 * Notify the backend that a player rerolled off a word without sending any messages.
 * @param targetWordId  The DB id of the word that was rerolled.
 */
export async function rerollWord(targetWordId: number): Promise<void> {
  await apiClient.fetch<{ success: boolean }>('/api/target-word/reroll', {
    method: 'POST',
    body: JSON.stringify({ targetWordId }),
  });
}
