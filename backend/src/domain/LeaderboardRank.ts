/**
 * Prospective place on a lowest-score-wins board.
 * `betterCount` is how many saved scores are strictly lower.
 * Ties share a place.
 */
export class LeaderboardRank {
  readonly place: number;

  constructor(betterCount: number) {
    this.place = Math.max(0, Math.trunc(betterCount)) + 1;
  }
}
