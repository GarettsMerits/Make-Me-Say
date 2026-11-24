/**
 * One in-flight target-word request per difficulty.
 *
 * React remounts a new effect immediately in development. Sharing the
 * request keeps that remount from dealing a second word the player never sees.
 */
import type { Difficulty, TargetWordResponse } from './types';

export class TargetWordDeal {
  private pending: { key: string; promise: Promise<TargetWordResponse> } | null = null;

  constructor(
    private readonly fetchWord: (difficulty?: Difficulty) => Promise<TargetWordResponse>,
  ) {}

  load(difficulty?: Difficulty): Promise<TargetWordResponse> {
    const key = difficulty ?? '*';
    if (this.pending?.key === key) return this.pending.promise;

    const promise = this.fetchWord(difficulty).finally(() => {
      if (this.pending?.promise === promise) this.pending = null;
    });
    this.pending = { key, promise };
    return promise;
  }
}
