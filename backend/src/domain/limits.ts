/** Display names on the leaderboard. Matches the win-flow bar input. */
export const PLAYER_NAME_MAX_LENGTH = 32;

/** One chat turn. Stops a single request from forwarding a huge prompt upstream. */
export const CHAT_MESSAGE_MAX_LENGTH = 4_000;

/**
 * Largest incomplete upstream SSE line kept in memory.
 * A stream that never emits a newline cannot grow past this.
 */
export const UPSTREAM_SSE_BUFFER_MAX = 1_048_576;
