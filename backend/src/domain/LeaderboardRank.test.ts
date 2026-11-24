import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LeaderboardRank } from './LeaderboardRank.js';

describe('LeaderboardRank', () => {
  it('gives the best place when nobody has a lower score', () => {
    assert.equal(new LeaderboardRank(0).place, 1);
  });

  it('shares a place on a tie by ignoring equal scores', () => {
    assert.equal(new LeaderboardRank(2).place, 3);
  });

  it('gives place 1 on an empty board', () => {
    assert.equal(new LeaderboardRank(0).place, 1);
  });
});
