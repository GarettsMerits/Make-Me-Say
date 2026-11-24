/**
 * Frees space once the database is at or over its size limit.
 *
 * Leaderboard rows are never deleted. Ended rounds with no entry are removed
 * first. Only when every remaining session is a leaderboard-recorded round
 * may those conversations be stripped down to the featured leaderboard message.
 */

const DEFAULT_BATCH = 25;
const MAX_BATCHES = 40;

export interface RetentionStore {
  sizeBytes(): Promise<number>;
  /** Delete oldest ended rounds that were not declined and have no leaderboard entry. */
  deleteOldestUnrecorded(limit: number): Promise<number>;
  /** True when every remaining session is a leaderboard-recorded round. */
  onlyRecordedRoundsRemain(): Promise<boolean>;
  /** Leave only the featured reply on leaderboard-recorded rounds. */
  stripRecordedConversations(limit: number): Promise<number>;
  /** Ask the engine to return freed pages so the next size check can fall. */
  reclaim(): Promise<void>;
}

export class ConversationRetention {
  constructor(
    private readonly limitBytes: number,
    private readonly store: RetentionStore,
    private readonly batchSize = DEFAULT_BATCH,
  ) {}

  /**
   * Free space until the database is under the limit, nothing eligible remains,
   * or this pass has done enough batches.
   * @returns how many rounds were deleted or stripped.
   */
  async enforce(): Promise<number> {
    let removed = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const size = await this.store.sizeBytes();
      if (size < this.limitBytes) return removed;

      const deleted = await this.store.deleteOldestUnrecorded(this.batchSize);
      if (deleted > 0) {
        removed += deleted;
        await this.store.reclaim();
        continue;
      }

      if (!(await this.store.onlyRecordedRoundsRemain())) return removed;

      const stripped = await this.store.stripRecordedConversations(this.batchSize);
      if (stripped === 0) return removed;
      removed += stripped;
      await this.store.reclaim();
    }
    return removed;
  }
}
