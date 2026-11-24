import React from 'react';
import { render, screen } from '@testing-library/react';
import BottomBar from './BottomBar';
import { useGameStore } from '../../store/useGameStore';

beforeAll(() => {
  const existing = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof existing?.randomUUID !== 'function') {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
      configurable: true,
    });
  }
});

beforeEach(() => {
  localStorage.clear();
});

it('replaces the provisional place with the current rank after a commit', () => {
  useGameStore.setState({
    isWon: true,
    scoreSubmitted: true,
    lockedScore: 12,
    sessionTokens: 12,
    wonRank: 2,
    rankUnavailable: false,
    victoryState: 'prompt',
    difficulty: 'hard',
    targetWord: 'banana',
    isLoading: false,
    draft: '',
  });

  render(<BottomBar onSubmit={() => {}} onReset={() => {}} />);

  expect(screen.getByText(/2nd place/)).toBeInTheDocument();
  expect(screen.queryByText(/provisional place/i)).not.toBeInTheDocument();
});

it('hides the provisional place after a decline and still shows the score', () => {
  useGameStore.setState({
    isWon: true,
    scoreSubmitted: false,
    lockedScore: 12,
    sessionTokens: 12,
    wonRank: 2,
    rankUnavailable: false,
    victoryState: 'declined',
    difficulty: 'hard',
    targetWord: 'banana',
    isLoading: false,
    draft: '',
  });

  render(<BottomBar onSubmit={() => {}} onReset={() => {}} />);

  expect(screen.getByText(/Score:/)).toBeInTheDocument();
  expect(screen.queryByText(/provisional place/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/2nd place/)).not.toBeInTheDocument();
});
