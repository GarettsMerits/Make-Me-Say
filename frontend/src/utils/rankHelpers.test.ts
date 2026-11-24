import { leaderboardPlaceSentence, rankLabel } from './rankHelpers';

describe('leaderboard place copy', () => {
  it('uses the place the board returned', () => {
    expect(leaderboardPlaceSentence(1, false)).toBe('Your provisional place is 🥇 1st place.');
    expect(rankLabel(4)).toBe('4th place');
  });

  it('does not invent a place while the board is still answering', () => {
    expect(leaderboardPlaceSentence(null, false)).toBe(
      'Your place on the leaderboard is still being counted.',
    );
    expect(leaderboardPlaceSentence(null, false)).not.toMatch(/999/);
  });

  it('says when the place could not be loaded', () => {
    expect(leaderboardPlaceSentence(null, true)).toBe(
      'Your place on the leaderboard could not be loaded.',
    );
  });
});
