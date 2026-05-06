/**
 * Game Session Store
 * 
 * Manages the state of an active game session including:
 * - Token counting and limits
 * - Chat messages
 * - Target word the user is trying to make the LLM say
 * - Loading states for async operations
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage } from './types';

interface GameState {
  // ===== STATE =====
  sessionTokens: number;            // Tokens count for current session
  targetWord: string;               // Word the user is trying to make LLM say
  targetWordId: number | null;      // DB primary key of targetWord (used on first chat message)
  messages: ChatMessage[];          // Chat conversation history
  isLoading: boolean;               // Loading state for async operations (LLM calls)
  sessionId: string | null;         // Backend session ID returned after first chat message
  isWon: boolean;                   // Whether the player has won the current session
  wonRank: number | null;           // Leaderboard rank player would achieve upon winning
  
  // ===== ACTIONS =====
  addSessionTokens: (count: number) => void;              // Add tokens to session
  setTargetWord: (word: string, id: number) => void;      // Set the target word and its DB id
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;  // Add chat message
  updateLastMessage: (chunk: string) => void;                            // Append text to last LLM message
  setIsLoading: (loading: boolean) => void;               // Set loading state
  setSessionId: (id: string) => void;                     // Store backend session ID
  setIsWon: (won: boolean) => void;                       // Mark session as won
  setWonRank: (rank: number) => void;                     // Store leaderboard rank for the win
  scoreSubmitted: boolean;                                // True once the player has submitted their score
  setScoreSubmitted: (submitted: boolean) => void;        // Mark score as submitted
  resetSession: () => void;                               // Clear session data
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
      targetWord: '',
      targetWordId: null,
      messages: [],
      isLoading: false,
      sessionId: null,
      isWon: false,
      wonRank: null,
      scoreSubmitted: false,
      
      // ===== ACTION IMPLEMENTATIONS =====
      addSessionTokens: (count) => set((state) => ({ 
        sessionTokens: state.sessionTokens + count 
      })),
      
      /**
       * Set the target word and its database primary key for this game session.
       * The id is used on the first chat request so the server can verify the word
       * without trusting the client-supplied string.
       */
      setTargetWord: (word, id) => set({ targetWord: word, targetWordId: id }),
      
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

      /** Mark the current session as won. */
      setIsWon: (won) => set({ isWon: won }),

      /** Store the leaderboard rank the player achieved when they won. */
      setWonRank: (rank) => set({ wonRank: rank }),

      /** Mark the score as submitted so the victory bar is locked on return. */
      setScoreSubmitted: (submitted) => set({ scoreSubmitted: submitted }),
      
      /**
       * Reset all session data to start fresh
       * 
       * USE CASE: Starting a new game
       * NOTE: Keeps tokenCount for overall stats, resets session-specific data
       */
      resetSession: () => set({ 
        sessionTokens: 0,
        targetWord: '',
        targetWordId: null,
        messages: [],
        isLoading: false,
        sessionId: null,
        isWon: false,
        wonRank: null,
        scoreSubmitted: false,
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
        targetWord: state.targetWord,
        targetWordId: state.targetWordId,
        sessionId: state.sessionId,
        scoreSubmitted: state.scoreSubmitted,
        // isLoading deliberately excluded
      }),
    }
  )
);