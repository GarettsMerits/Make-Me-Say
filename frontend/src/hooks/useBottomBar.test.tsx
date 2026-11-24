import { renderHook, act } from '@testing-library/react';
import { useBottomBar } from './useBottomBar';
import { useGameStore } from '../store/useGameStore';
import { useUIStore } from '../store/useUIStore';
import { submitScore } from '../utils/api';

jest.mock('../utils/api', () => ({
  fetchLeaderboardRank: jest.fn(() => Promise.resolve(1)),
  submitScore: jest.fn(),
  declineSession: jest.fn(() => Promise.resolve()),
}));

const submit = submitScore as jest.MockedFunction<typeof submitScore>;

beforeEach(() => {
  localStorage.clear();
  submit.mockReset();
  useGameStore.setState({
    sessionId: 'session-1',
    difficulty: 'hard',
    isWon: true,
    scoreSubmitted: false,
    lockedScore: 12,
    sessionTokens: 12,
    wonRank: 4,
    draft: '',
    scoreName: 'Ada',
  });
  useUIStore.setState({
    leaderboardTab: 'normal',
    currentPage: 'chat',
    pendingHighlightId: null,
  });
});

it('opens this difficulty’s leaderboard and keeps the entry’s current rank', async () => {
  submit.mockResolvedValue({
    success: true,
    id: 9,
    rank: 2,
    tokenCount: 12,
    message: 'Score submitted successfully! You ranked #2',
  });

  const { result } = renderHook(() => useBottomBar({
    onSubmit: () => {},
    onReset: () => {},
  }));

  await act(async () => {
    await result.current.handleScoreSubmit('Ada');
  });

  expect(useUIStore.getState().leaderboardTab).toBe('hard');
  expect(useUIStore.getState().currentPage).toBe('leaderboard');
  expect(useGameStore.getState().wonRank).toBe(2);
  expect(useGameStore.getState().scoreSubmitted).toBe(true);
});
