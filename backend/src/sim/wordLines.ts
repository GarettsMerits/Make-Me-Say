/**
 * Lines for a simulated game. Player lines never contain the target.
 * A model line contains the target only when asked for one or more copies.
 */

const FILLER = [
  'stone', 'river', 'quiet', 'garden', 'lantern', 'window', 'pencil', 'market',
  'silver', 'cloud', 'forest', 'bridge', 'yellow', 'pocket', 'morning', 'harbor',
  'candle', 'circle', 'velvet', 'orange', 'meadow', 'compass', 'ticket', 'mirror',
];

function filler(target: string, random: () => number): string {
  const choices = FILLER.filter((word) => word.toLowerCase() !== target.toLowerCase());
  const index = Math.min(choices.length - 1, Math.floor(random() * choices.length));
  return choices[index] ?? 'stone';
}

/** A player message. It does not use the target word. */
export function playerLine(target: string, random: () => number = Math.random): string {
  const count = 2 + Math.floor(random() * 4);
  return Array.from({ length: count }, () => filler(target, random)).join(' ');
}

/**
 * A model reply. `copies` is how many times the target word is inserted.
 * Zero copies is an ordinary reply. A copy is sometimes written tight against
 * punctuation, which still counts as the word.
 */
export function modelLine(target: string, copies: number, random: () => number = Math.random): string {
  const words = Array.from({ length: 5 }, () => filler(target, random));
  const times = Math.max(0, Math.trunc(copies));
  for (let i = 0; i < times; i += 1) {
    const token = random() < 0.5 ? target : `${target}!`;
    const at = Math.floor(random() * (words.length + 1));
    words.splice(at, 0, token);
  }
  return words.join(' ');
}

/**
 * Early replies stay off the target. Later replies become more likely to
 * include it, and the sixth reply always does, one to three times.
 */
export function replyForTurn(target: string, turn: number, random: () => number = Math.random): string {
  const emit = turn >= 6 || random() < Math.max(0, turn - 1) / 6;
  const copies = emit ? 1 + Math.floor(random() * 3) : 0;
  return modelLine(target, copies, random);
}
