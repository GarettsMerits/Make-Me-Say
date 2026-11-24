import { VALID_DIFFICULTIES, type Difficulty } from '../types.js';

/** Read a difficulty stored as an unknown column value. */
export function asDifficulty(value: unknown): Difficulty | null {
  return typeof value === 'string' && VALID_DIFFICULTIES.includes(value as Difficulty)
    ? (value as Difficulty)
    : null;
}
