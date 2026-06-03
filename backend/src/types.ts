/**
 * Shared backend types.
 * Import from here instead of redefining in individual files.
 */

export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

export const VALID_DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];
