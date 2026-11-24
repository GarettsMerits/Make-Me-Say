/**
 * One difficulty's board in MySQL.
 * Place is one plus the number of entries on that difficulty with a strictly lower score.
 * A page is a single query. The in-memory board remains the one a live Round uses in tests.
 */
import { LeaderboardRank } from '../domain/LeaderboardRank.js';
import type { Difficulty } from '../types.js';

export interface SqlExecutor {
  execute(sql: string, params?: readonly unknown[]): Promise<[unknown, unknown]>;
}

export interface BoardEntry {
  id: number;
  player_name: string;
  token_count: number;
  target_word: string;
  difficulty: Difficulty;
  llm_victory_message: string | null;
  completed_at: string;
  session_id: string | null;
  /** Live place on this difficulty. Equal scores share it. */
  rank?: number;
}

export interface BoardPage {
  entries: BoardEntry[];
  hasMore: boolean;
}

export interface BoardPlace {
  rank: number;
  total: number;
}

const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10_000;

/** Strictly lower score on the same difficulty. Ties do not count. */
const BETTER_THAN_SCORE = 'token_count < ? AND difficulty = ?';
const BETTER_THAN_ROW = 'better.token_count < l.token_count AND better.difficulty = l.difficulty';

export class MysqlLeaderboard {
  constructor(private readonly db: SqlExecutor) {}

  /** The place `score` would take on this difficulty right now, and the size of that board. */
  async place(score: number, difficulty: Difficulty): Promise<BoardPlace> {
    const [rows] = await this.db.execute(
      `SELECT
         (SELECT COUNT(*) FROM leaderboard WHERE ${BETTER_THAN_SCORE}) AS better,
         (SELECT COUNT(*) FROM leaderboard WHERE difficulty = ?) AS total`,
      [score, difficulty, difficulty],
    );
    const row = (rows as Array<{ better?: unknown; total?: unknown }>)[0];
    return {
      rank: new LeaderboardRank(Number(row?.better ?? 0)).place,
      total: Number(row?.total ?? 0),
    };
  }

  /**
   * One page, best score first. Equal scores share a place and the earlier
   * commit is listed first. Fetches one extra row to see whether another page exists.
   */
  async page(difficulty: Difficulty, limit: number, offset = 0): Promise<BoardPage> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 1, MAX_PAGE_SIZE));
    const safeOffset = Math.max(0, Math.min(Math.trunc(offset) || 0, MAX_OFFSET));
    const [rows] = await this.db.execute(
      `SELECT l.id, l.player_name, l.token_count, l.target_word, l.difficulty,
              l.llm_victory_message, l.completed_at, l.session_id,
              (SELECT COUNT(*) FROM leaderboard AS better
                WHERE ${BETTER_THAN_ROW}) AS better
         FROM leaderboard AS l
        WHERE l.difficulty = ?
        ORDER BY l.token_count ASC, l.completed_at ASC
        LIMIT ${safeLimit + 1} OFFSET ${safeOffset}`,
      [difficulty],
    );
    const found = (rows as Array<BoardEntry & { better?: unknown }>).map((row) => {
      const { better, ...entry } = row;
      return { ...entry, rank: new LeaderboardRank(Number(better ?? 0)).place };
    });
    const hasMore = found.length > safeLimit && safeOffset < MAX_OFFSET;
    return { entries: found.slice(0, safeLimit), hasMore };
  }
}
