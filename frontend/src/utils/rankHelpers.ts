/**
 * Rank display helpers shared across victory UI components.
 */

/**
 * Returns a human-readable rank label with an appropriate medal emoji.
 * @example rankLabel(1) → "🥇 1st place"
 * @example rankLabel(4) → "#4"
 */
function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function rankLabel(rank: number): string {
  if (rank === 1) return `🥇 1st place`;
  if (rank === 2) return `🥈 2nd place`;
  if (rank === 3) return `🥉 3rd place`;
  return `${rank}${ordinalSuffix(rank)} place`;
}

/**
 * The clause that follows the score. A missing rank is not given a number.
 */
export function leaderboardPlaceSentence(rank: number | null, unavailable: boolean): string {
  if (typeof rank === 'number') return `Your provisional place is ${rankLabel(rank)}.`;
  if (unavailable) return 'Your place on the leaderboard could not be loaded.';
  return 'Your place on the leaderboard is still being counted.';
}

/**
 * Returns a Tailwind text-colour class pair (light/dark) for the given rank.
 * Gold for 1st, silver for 2nd, bronze for 3rd, blue for all others.
 */
export function rankColourClass(rank: number | null): string {
  if (rank === 1) return 'text-yellow-500 dark:text-yellow-400';
  if (rank === 2) return 'text-slate-400 dark:text-slate-300';
  if (rank === 3) return 'text-amber-600 dark:text-amber-500';
  return 'text-blue-600 dark:text-blue-400';
}
