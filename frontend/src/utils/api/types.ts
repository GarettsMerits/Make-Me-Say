/**
 * Shared request / response types for every backend endpoint.
 *
 * Kept in a single file so domain modules can import types without
 * creating circular dependencies between each other.
 */

// ─── Difficulty ───────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

// ─── Target Word ──────────────────────────────────────────────────────────────

export interface TargetWordResponse {
  id: number;
  word: string;
  difficulty: Difficulty;
}

// ─── Chat / SSE ───────────────────────────────────────────────────────────────

/**
 * Body sent to POST /api/chat.
 *
 * First message: omit sessionId, include targetWordId.
 * Subsequent messages: include sessionId, omit targetWordId.
 */
export interface ChatRequest {
  /** Omit on the very first message; include on all later messages. */
  sessionId?: string;
  /**
   * Required only when sessionId is absent (first message).
   * The numeric DB id returned alongside the word by fetchTargetWord().
   * The server resolves the actual word so the client can never forge it.
   */
  targetWordId?: number;
  message: string;
}

/** Payload delivered on the `done` SSE event. */
export interface ChatDonePayload {
  sessionId: string;
  tokenCount: number;
  /** tiktoken count of the player message that just finished. */
  userTokenCount: number;
  totalTokens: number;
  /**
   * Player tokens for this round. After a win this is the locked score.
   * Before that it is the sent-message portion of the token preview.
   */
  playerTokens: number;
  gameOver: boolean;
  targetWordDetected: boolean;
  /** The LLM message that contained the target word (only present when gameOver=true). */
  llmVictoryMessage?: string;
}

/** Caller-supplied callbacks for reacting to each streaming event. */
export interface StreamCallbacks {
  /** Called once with the sessionId as soon as the server sends the `meta` event. */
  onSessionId: (sessionId: string) => void;
  /** Called for each text delta arriving from the LLM. */
  onChunk: (text: string) => void;
  /** Called once when the stream is complete, with final metadata. */
  onDone: (payload: ChatDonePayload) => void;
  /** Called if the server or network sends an error. */
  onError: (err: Error) => void;
  /** Called for each text delta of the loss-acknowledgement message (optional). */
  onLossChunk?: (text: string) => void;
  /** Called once the loss-acknowledgement stream is complete (optional). */
  onLossDone?: (text: string) => void;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: number;
  player_name: string;
  token_count: number;
  target_word: string;
  difficulty: Difficulty;
  llm_victory_message: string | null;
  completed_at: string;
  session_id: string | null;
  /** Live place on this difficulty. Equal scores share it. */
  rank: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  count: number;
  hasMore: boolean;
}

export interface SubmitScoreRequest {
  playerName: string;
  sessionId: string;
}

export interface SubmitScoreResponse {
  success: boolean;
  id: number;
  rank: number;
  tokenCount: number;
  message: string;
}

export interface LeaderboardStats {
  totalGames: number;
  averageTokens: number;
  bestScore: number;
  worstScore: number;
  popularWords: { target_word: string; count: number }[];
}

