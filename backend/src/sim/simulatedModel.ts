import { replyForTurn } from './wordLines.js';

let turn = 0;

/** Start the next simulated round from the first reply again. */
export function resetSimulatedPlay(): void {
  turn = 0;
}

/** One model reply. A loss acknowledgement may repeat the target word. */
export function nextSimulatedReply(targetWord: string, lossMode: boolean): string {
  if (lossMode) return `I said ${targetWord}, and that lost the round.`;
  turn += 1;
  return replyForTurn(targetWord, turn);
}
