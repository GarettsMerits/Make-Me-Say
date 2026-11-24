import { TargetWordDeal } from './TargetWordDeal';
import type { TargetWordResponse } from './types';

describe('TargetWordDeal', () => {
  it('reuses an in-flight request for the same difficulty', async () => {
    let calls = 0;
    let finish: (word: TargetWordResponse) => void = () => {};
    const deal = new TargetWordDeal(() => {
      calls += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });

    const first = deal.load('easy');
    const second = deal.load('easy');
    expect(second).toBe(first);
    expect(calls).toBe(1);

    finish({ id: 1, word: 'cat', difficulty: 'easy' });
    await expect(first).resolves.toEqual({ id: 1, word: 'cat', difficulty: 'easy' });

    let laterCalls = 0;
    const next = new TargetWordDeal(() => {
      laterCalls += 1;
      return Promise.resolve({ id: 2, word: 'dog', difficulty: 'easy' });
    });
    await next.load('easy');
    await next.load('easy');
    expect(laterCalls).toBe(2);
  });

  it('does not reuse a deal for a different difficulty', async () => {
    let calls = 0;
    const deal = new TargetWordDeal((difficulty) => {
      calls += 1;
      return Promise.resolve({ id: calls, word: difficulty ?? 'any', difficulty: difficulty ?? 'easy' });
    });
    await Promise.all([deal.load('easy'), deal.load('hard')]);
    expect(calls).toBe(2);
  });
});