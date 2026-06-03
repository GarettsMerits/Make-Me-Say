/**
 * Public API surface — barrel re-export.
 *
 * Every consumer that imports from `../utils/api` gets all types and
 * functions from here without needing to know the internal file structure.
 */
export * from './types';
export * from './client';      // setPassphrase, clearPassphrase
export * from './passphrase';  // verifyPassphrase
export * from './targetWord';  // fetchTargetWord, rerollWord
export * from './chat';        // sendChatMessage
export * from './leaderboard'; // fetchLeaderboard, fetchLeaderboardRank, submitScore, fetchLeaderboardStats
