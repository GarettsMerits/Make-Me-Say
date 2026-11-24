import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage, VictoryState } from './types';
import type { Difficulty } from '../utils/api/types';

interface GameState {
  // ===== STATE =====
  sessionTokens: number;            // Sent player tokens. The token preview adds the draft on top.
  lockedScore: number | null;        // Player tokens frozen at the win. Null until then.
  targetWord: string;               // Word the user is trying to make LLM say
  targetWordId: number | null;      // DB primary key of targetWord (used on first chat message)
  difficulty: Difficulty | null;    // Selected difficulty level (null = not yet chosen)
  messages: ChatMessage[];          // Chat conversation history
  isLoading: boolean;               // Loading state for async operations (LLM calls)
  sessionId: string | null;         // Backend session ID returned after first chat message
  isWon: boolean;                   // Whether the server has recorded a win for this round
  winningMessageId: string | null;  // The model reply the server named as the win
  wonRank: number | null;           // Leaderboard rank player would achieve upon winning
  rankUnavailable: boolean;         // The rank request failed; do not invent a place
  victoryMessage: string | null;    // The LLM message that contained the target word
  
  // ===== ACTIONS =====
  addSessionTokens: (count: number) => void;
  setSessionTokens: (count: number) => void;
  lockScore: (score: number) => void;
  setLastUserTokenCount: (count: number) => void;
  revertLastTurn: (estimatedTokens: number) => void;
  setTargetWord: (word: string, id: number) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastMessage: (chunk: string) => void;
  setIsLoading: (loading: boolean) => void;
  setSessionId: (id: string | null) => void;
  victoryState: VictoryState;
  setVictoryState: (state: VictoryState) => void;
  setIsWon: (won: boolean) => void;
  setWinningMessageId: (id: string | null) => void;
  setWonRank: (rank: number) => void;
  setRankUnavailable: (unavailable: boolean) => void;
  setVictoryMessage: (message: string | null) => void;
  scoreSubmitted: boolean;
  setScoreSubmitted: (submitted: boolean) => void;
  /** Composer text. Kept here so leaving the chat page does not discard it. */
  draft: string;
  setDraft: (text: string) => void;
  /** Display name typed on the win-flow bar. */
  scoreName: string;
  setScoreName: (name: string) => void;
  resetSession: () => void;
}

/**
 * Create the game session store
 * 
 * PERSISTENCE STRATEGY:
 * - Persist session data so users don't lose progress on refresh
 * - But NOT isLoading (always start with false)
 * - Could add TTL or session expiry logic here if needed
 */
export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      // ===== INITIAL VALUES =====
      sessionTokens: 0,
      lockedScore: null,
      targetWord: '',
      targetWordId: null,
      difficulty: null,
      messages: [],
      isLoading: false,
      sessionId: null,
      victoryState: 'prompt',
      isWon: false,
      winningMessageId: null,
      wonRank: null,
      rankUnavailable: false,
      victoryMessage: null,
      scoreSubmitted: false,
      draft: '',
      scoreName: '',
      
      // ===== ACTION IMPLEMENTATIONS =====
      addSessionTokens: (count) => set((state) => (
        state.lockedScore !== null ? {} : { sessionTokens: state.sessionTokens + count }
      )),

      /** Replace the running total with the server's player-only count. */
      setSessionTokens: (count) => set((state) => (
        state.lockedScore !== null ? {} : { sessionTokens: count }
      )),

      /** Freeze the score at the win. Later token updates do not move it. */
      lockScore: (score) => set({ lockedScore: score, sessionTokens: score, isWon: true }),

      setLastUserTokenCount: (count) => set((state) => {
        const messages = [...state.messages];
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].sender === 'user') {
            messages[i] = { ...messages[i], tokenCount: count };
            break;
          }
        }
        return { messages };
      }),

      /**
       * Drop the optimistic user bubble and the model placeholder from a turn
       * the server did not persist.
       */
      revertLastTurn: (estimatedTokens) => set((state) => {
        const messages = [...state.messages];
        if (messages[messages.length - 1]?.sender === 'llm') messages.pop();
        if (messages[messages.length - 1]?.sender === 'user') messages.pop();
        return {
          messages,
          sessionTokens: Math.max(0, state.sessionTokens - estimatedTokens),
        };
      }),
      
      /** Set the target word and its database primary key for this game session. */
      setTargetWord: (word, id) => set({ targetWord: word, targetWordId: id }),

      /** Set the chosen difficulty for this game. */
      setDifficulty: (difficulty) => set({ difficulty }),

      /** Store the LLM message that contained the winning target word. */
      setVictoryMessage: (message) => set({ victoryMessage: message }),
      
      /**
       * IMMUTABILITY PATTERN:
       * - Spread existing messages into new array
       * - Add new message with generated id and timestamp
       * - Never mutate the existing array directly
       * 
       * OMIT UTILITY TYPE:
       * - Caller provides text and sender
       * - We generate id and timestamp here
       * - TypeScript ensures caller can't pass id/timestamp
       */
      addMessage: (message) => set((state) => ({
        messages: [
          ...state.messages,
          {
            ...message,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          },
        ],
      })),

      /**
       * Append a streaming text chunk to the last LLM message.
       * Called repeatedly as the SSE stream delivers deltas.
       */
      updateLastMessage: (chunk) => set((state) => {
        const msgs = [...state.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.sender === 'llm') {
          msgs[msgs.length - 1] = { ...last, text: last.text + chunk };
        }
        return { messages: msgs };
      }),
      
      /**
       * Set loading state
       * 
       * USE CASE: Show spinner while waiting for LLM response
       */
      setIsLoading: (loading) => set({ isLoading: loading }),

      /**
       * Store the backend session ID returned after the first chat message
       * 
       * USE CASE: Sent with subsequent messages so the backend can track conversation
       */
      setSessionId: (id) => set({ sessionId: id }),

      setVictoryState: (victoryState) => set({ victoryState }),

      /** Mark the current session as won. */
      setIsWon: (won) => set({ isWon: won }),

      /** Remember the reply the server named as the win, so a reload can highlight it. */
      setWinningMessageId: (winningMessageId) => set({ winningMessageId }),

      /** Store the leaderboard rank the player achieved when they won. */
      setWonRank: (rank) => set({ wonRank: rank, rankUnavailable: false }),

      setRankUnavailable: (rankUnavailable) => set({ rankUnavailable }),

      /** Mark the score as submitted so the win-flow bar is locked on return. */
      setScoreSubmitted: (submitted) => set({ scoreSubmitted: submitted }),

      setDraft: (draft) => set({ draft }),

      setScoreName: (scoreName) => set({ scoreName }),
      
      /**
       * Reset all session data to start fresh
       * 
       * USE CASE: Starting a new game
       * NOTE: Keeps tokenCount for overall stats, resets session-specific data
       */
      resetSession: () => set({ 
        sessionTokens: 0,
        lockedScore: null,
        targetWord: '',
        targetWordId: null,
        difficulty: null,
        messages: [],
        isLoading: false,
        sessionId: null,
        victoryState: 'prompt',
        isWon: false,
        winningMessageId: null,
        wonRank: null,
        rankUnavailable: false,
        victoryMessage: null,
        scoreSubmitted: false,
        draft: '',
        scoreName: '',
      }),
    }),
    {
      name: 'game-session',  // localStorage key
      
      /**
       * Selective persistence
       * 
       * PERSIST: messages, sessionTokens, targetWord, sessionId (resume game on refresh)
       * DON'T PERSIST: isLoading (always start false)
       */
      partialize: (state) => ({
        messages: state.messages,
        sessionTokens: state.sessionTokens,
        lockedScore: state.lockedScore,
        targetWord: state.targetWord,
        targetWordId: state.targetWordId,
        difficulty: state.difficulty,
        sessionId: state.sessionId,
        victoryState: state.victoryState,
        isWon: state.isWon,
        winningMessageId: state.winningMessageId,
        scoreSubmitted: state.scoreSubmitted,
        draft: state.draft,
        scoreName: state.scoreName,
        wonRank: state.wonRank,
        // isLoading, rankUnavailable, victoryMessage deliberately excluded
      }),
    }
  )
);