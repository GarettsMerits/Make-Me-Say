import { renderHook, act } from '@testing-library/react';
import { useChatLogic } from './useChatLogic';
import { useGameStore } from '../store/useGameStore';
import { useUIStore } from '../store/useUIStore';
import { abandonSession, fetchLeaderboardRank, sendChatMessage, targetWordDeal, type StreamCallbacks } from '../utils/api';

jest.mock('../utils/api', () => ({
  sendChatMessage: jest.fn(),
  fetchLeaderboardRank: jest.fn(() => Promise.resolve(4)),
  abandonSession: jest.fn(() => Promise.resolve()),
  rerollWord: jest.fn(() => Promise.resolve()),
  targetWordDeal: { load: jest.fn(() => new Promise(() => {})) },
}));

const send = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;
const rank = fetchLeaderboardRank as jest.MockedFunction<typeof fetchLeaderboardRank>;
const abandon = abandonSession as jest.MockedFunction<typeof abandonSession>;

beforeAll(() => {
  const existing = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof existing?.randomUUID !== 'function') {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
      configurable: true,
    });
  }
});

function playing(): void {
  useGameStore.setState({
    difficulty: 'easy',
    targetWord: 'banana',
    targetWordId: 1,
    sessionId: 'session-1',
    messages: [],
    isLoading: false,
    isWon: false,
    lockedScore: null,
    sessionTokens: 0,
    scoreSubmitted: false,
    victoryState: 'prompt',
    wonRank: null,
    draft: '',
  });
  useUIStore.setState({ hasSeenGame: true });
}

beforeEach(() => {
  localStorage.clear();
  playing();
  send.mockReset();
  rank.mockReset();
  rank.mockResolvedValue(4);
  abandon.mockReset();
  abandon.mockResolvedValue(undefined);
  (targetWordDeal.load as jest.Mock).mockImplementation(() => new Promise(() => {}));
});

it('ignores reset while a reply is still arriving, and that reply can still win', async () => {
  let callbacks: StreamCallbacks | undefined;
  send.mockImplementation(async (_request, next) => {
    callbacks = next;
  });

  const { result } = renderHook(() => useChatLogic());

  await act(async () => {
    await result.current.handleSubmit('hello');
  });

  act(() => {
    callbacks?.onChunk('not yet');
  });

  expect(result.current.isLoading).toBe(true);

  act(() => {
    result.current.handleReset();
  });

  expect(result.current.showDifficultyDialog).toBe(false);

  await act(async () => {
    callbacks?.onDone({
      sessionId: 'session-1',
      tokenCount: 2,
      userTokenCount: 1,
      totalTokens: 3,
      playerTokens: 1,
      gameOver: true,
      targetWordDetected: true,
      llmVictoryMessage: 'say banana',
    });
  });

  expect(result.current.isWon).toBe(true);
  expect(useGameStore.getState().sessionId).toBe('session-1');
  expect(result.current.isLoading).toBe(false);

  act(() => {
    result.current.handleReset();
  });
  expect(result.current.showDifficultyDialog).toBe(true);
});

it('does not end the round when reset was already open and the reply is still arriving', async () => {
  let callbacks: StreamCallbacks | undefined;
  send.mockImplementation(async (_request, next) => {
    callbacks = next;
  });

  const { result } = renderHook(() => useChatLogic());

  act(() => {
    result.current.handleReset();
  });
  expect(result.current.showDifficultyDialog).toBe(true);

  await act(async () => {
    await result.current.handleSubmit('hello');
  });

  act(() => {
    callbacks?.onChunk('not yet');
    result.current.handleDifficultyConfirm('hard');
  });

  expect(useGameStore.getState().sessionId).toBe('session-1');
  expect(useGameStore.getState().messages.length).toBe(2);

  await act(async () => {
    callbacks?.onDone({
      sessionId: 'session-1',
      tokenCount: 2,
      userTokenCount: 1,
      totalTokens: 3,
      playerTokens: 1,
      gameOver: true,
      targetWordDetected: true,
      llmVictoryMessage: 'banana',
    });
  });

  expect(result.current.isWon).toBe(true);
});

it('does not let a late loss reply land on the next round', async () => {
  const turns: StreamCallbacks[] = [];
  send.mockImplementation(async (_request, next) => {
    turns.push(next);
  });

  const { result } = renderHook(() => useChatLogic());

  await act(async () => {
    await result.current.handleSubmit('hello');
  });
  await act(async () => {
    turns[0]?.onDone({
      sessionId: 'session-1',
      tokenCount: 2,
      userTokenCount: 1,
      totalTokens: 3,
      playerTokens: 1,
      gameOver: true,
      targetWordDetected: true,
      llmVictoryMessage: 'banana',
    });
  });

  act(() => {
    result.current.handleReset();
    result.current.handleDifficultyConfirm('easy');
  });
  act(() => {
    useGameStore.setState({ targetWord: 'apple', targetWordId: 2, sessionId: null });
  });

  await act(async () => {
    await result.current.handleSubmit('next');
  });
  act(() => {
    turns[0]?.onLossChunk?.('sore loser');
  });

  const last = useGameStore.getState().messages.at(-1);
  expect(last?.text ?? '').toBe('');
});

it('reads the current rank again when a committed round is restored', async () => {
  rank.mockResolvedValue(2);
  useGameStore.setState({
    difficulty: 'hard',
    targetWord: 'banana',
    targetWordId: 1,
    sessionId: 'session-1',
    messages: [
      { id: '1', text: 'hi', sender: 'user', timestamp: 1, tokenCount: 12 },
      { id: '2', text: 'banana', sender: 'llm', timestamp: 2 },
    ],
    isLoading: false,
    isWon: false,
    lockedScore: 12,
    sessionTokens: 12,
    scoreSubmitted: true,
    wonRank: 5,
  });

  renderHook(() => useChatLogic());

  await act(async () => {
    await Promise.resolve();
  });

  expect(useGameStore.getState().wonRank).toBe(2);
});

it('leaves a stored provisional place in place while the win is still undecided', async () => {
  rank.mockResolvedValue(1);
  useGameStore.setState({
    difficulty: 'hard',
    targetWord: 'banana',
    targetWordId: 1,
    sessionId: 'session-1',
    messages: [
      { id: '1', text: 'hi', sender: 'user', timestamp: 1, tokenCount: 12 },
      { id: '2', text: 'banana', sender: 'llm', timestamp: 2 },
    ],
    isLoading: false,
    isWon: false,
    lockedScore: 12,
    sessionTokens: 12,
    scoreSubmitted: false,
    wonRank: 4,
  });

  renderHook(() => useChatLogic());

  await act(async () => {
    await Promise.resolve();
  });

  expect(useGameStore.getState().wonRank).toBe(4);
});
