/**
 * Public API surface — barrel re-export.
 *
 * Every consumer that imports from `../utils/api` gets all types and
 * functions from here without needing to know the internal file structure.
 */
export * from './types';
export * from './client';
export * from './passphrase';  // verifyPassphrase, checkSession, logout
export * from './targetWord';  // fetchTargetWord, rerollWord
export * from './chat';        // sendChatMessage, abandonSession, declineSession
export * from './leaderboard'; // fetchLeaderboard, fetchLeaderboardRank, submitScore, fetchLeaderboardStats
