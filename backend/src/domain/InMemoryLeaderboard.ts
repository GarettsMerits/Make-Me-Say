import { LeaderboardRank } from './LeaderboardRank.js';
import type { Difficulty } from '../types.js';

export interface LeaderboardEntry {
  name: string;
  score: number;
  targetWord: string;
  difficulty: Difficulty;
  winningReply: string;
}

/** Readings a round needs from a board. Memory and the database both satisfy this. */
export interface Leaderboard {
  commit(entry: LeaderboardEntry): void;
  /** The place a score would take on this difficulty right now. */
  place(score: number, difficulty: Difficulty): number;
}

/** Test adapter. The running game uses the database behind the same commit. */
export class InMemoryLeaderboard implements Leaderboard {
  private readonly stored: LeaderboardEntry[] = [];

  commit(entry: LeaderboardEntry): void {
    this.stored.push({ ...entry });
  }

  entries(): readonly LeaderboardEntry[] {
    return this.stored;
  }

  /**
   * One difficulty's board, best score first. Equal scores share a rank
   * and the earlier commit is listed first. There is no combined board.
   */
  ranked(difficulty: Difficulty): ReadonlyArray<LeaderboardEntry & { rank: number }> {
    const rows = this.stored
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.difficulty === difficulty)
      .sort((a, b) => a.entry.score - b.entry.score || a.index - b.index);

    return rows.map(({ entry }) => ({
      ...entry,
      rank: this.place(entry.score, difficulty),
    }));
  }

  /** The place a score would take on this difficulty right now. */
  place(score: number, difficulty: Difficulty): number {
    const better = this.stored.filter(
      (entry) => entry.difficulty === difficulty && entry.score < score,
    ).length;
    return new LeaderboardRank(better).place;
  }
}
