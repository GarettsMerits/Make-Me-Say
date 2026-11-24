import type { VictoryState } from './types';

/**
 * What the win-flow bar is showing.
 * Derived from the flags already saved on this browser. It is not sent
 * to the server. A win, a score, a decline, and a commit are decided there.
 */
export type WinFlowPhase = 'playing' | 'awaiting-choice' | 'declined' | 'committed';

export function winFlowPhase(input: {
  isWon: boolean;
  scoreSubmitted: boolean;
  victoryState: VictoryState;
}): WinFlowPhase {
  if (!input.isWon) return 'playing';
  if (input.scoreSubmitted) return 'committed';
  if (input.victoryState === 'declined') return 'declined';
  return 'awaiting-choice';
}
