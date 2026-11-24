import { winFlowPhase } from './winFlowPhase';

describe('winFlowPhase', () => {
  it('stays on the composer until the server has recorded a win', () => {
    expect(winFlowPhase({ isWon: false, scoreSubmitted: false, victoryState: 'prompt' })).toBe('playing');
    expect(winFlowPhase({ isWon: false, scoreSubmitted: true, victoryState: 'declined' })).toBe('playing');
  });

  it('waits for a choice after a win, including while the name is being typed', () => {
    expect(winFlowPhase({ isWon: true, scoreSubmitted: false, victoryState: 'prompt' })).toBe('awaiting-choice');
    expect(winFlowPhase({ isWon: true, scoreSubmitted: false, victoryState: 'enter' })).toBe('awaiting-choice');
  });

  it('hides the choice after a decline, and a commit closes the bar even if decline was also saved', () => {
    expect(winFlowPhase({ isWon: true, scoreSubmitted: false, victoryState: 'declined' })).toBe('declined');
    expect(winFlowPhase({ isWon: true, scoreSubmitted: true, victoryState: 'declined' })).toBe('committed');
    expect(winFlowPhase({ isWon: true, scoreSubmitted: true, victoryState: 'prompt' })).toBe('committed');
  });
});
