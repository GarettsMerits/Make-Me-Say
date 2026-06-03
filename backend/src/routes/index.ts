/**
 * API router
 *
 * Public routes (no passphrase required):
 *   POST /api/auth/verify
 *
 * Protected routes (x-passphrase header required):
 *   GET  /api/target-word
 *   POST /api/target-word/reroll
 *   POST /api/chat
 *   GET  /api/leaderboard
 *   POST /api/leaderboard
 *   GET  /api/leaderboard/rank/:tokenCount
 *   GET  /api/leaderboard/stats
 */
import express from 'express';
import { authGate, default as authRouter } from '../middleware/passphrase.js';
import targetWordRouter  from './targetWord.js';
import chatRouter        from './chat.js';
import leaderboardRouter from './leaderboard.js';

const router = express.Router();

// Public: passphrase verification (must be before authGate)
router.use('/auth', authRouter);

// All remaining routes require a valid passphrase
router.use(authGate);
router.use('/target-word', targetWordRouter);
router.use('/chat',        chatRouter);
router.use('/leaderboard', leaderboardRouter);

export default router;
