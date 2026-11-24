/**
 * Leaderboard route
 *
 * Handles input validation and HTTP responses only.
 * All database logic lives in services/leaderboardService.ts.
 */
import express from 'express';
import type { Request, Response } from 'express';
import { PLAYER_NAME_MAX_LENGTH } from '../domain/limits.js';
import { clientErrorMessage, clientStatusCode, HttpError } from '../http/HttpError.js';
import {
  getEntries,
  getRank,
  submitSessionScore,
  getStats,
  type Difficulty,
} from '../services/leaderboardService.js';
import { VALID_DIFFICULTIES } from '../types.js';

const router = express.Router();

// ─── GET /api/leaderboard ─────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit      = Math.min(parseInt(req.query.limit as string, 10) || 10, 100);
    const offset     = parseInt(req.query.offset as string, 10) || 0;
    const difficulty = req.query.difficulty;
    if (typeof difficulty !== 'string' || !VALID_DIFFICULTIES.includes(difficulty as Difficulty)) {
      return res.status(400).json({ error: 'Choose a difficulty' });
    }

    const page = await getEntries(limit, offset, difficulty as Difficulty);
    res.json({ leaderboard: page.entries, count: page.entries.length, hasMore: page.hasMore });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ─── GET /api/leaderboard/rank/:tokenCount ────────────────────────────────────

router.get('/rank/:tokenCount', async (req: Request, res: Response) => {
  try {
    const tokenCount = parseInt(req.params.tokenCount ?? '0', 10);
    if (isNaN(tokenCount) || tokenCount < 0) {
      return res.status(400).json({ error: 'Invalid token count' });
    }

    const difficulty = req.query.difficulty;
    if (typeof difficulty !== 'string' || !VALID_DIFFICULTIES.includes(difficulty as Difficulty)) {
      return res.status(400).json({ error: 'Choose a difficulty' });
    }

    const result = await getRank(tokenCount, difficulty as Difficulty);
    res.json(result);
  } catch (error) {
    console.error('Error calculating rank:', error);
    res.status(500).json({ error: 'Failed to calculate rank' });
  }
});

// ─── POST /api/leaderboard ────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const { playerName, sessionId } = req.body;

    if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
      return res.status(400).json({ error: 'playerName is required and must be a non-empty string' });
    }
    if (playerName.trim().length > PLAYER_NAME_MAX_LENGTH) {
      return res.status(400).json({
        error: `playerName must be ${PLAYER_NAME_MAX_LENGTH} characters or fewer`,
      });
    }
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const result = await submitSessionScore(playerName.trim(), sessionId);

    res.status(201).json({
      success: true,
      id: result.id,
      rank: result.rank,
      tokenCount: result.tokenCount,
      message: `Score submitted successfully! You ranked #${result.rank}`,
    });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('Error submitting to leaderboard:', error);
    res.status(clientStatusCode(error)).json({
      error: clientErrorMessage(error, 'Failed to submit score'),
    });
  }
});

// ─── GET /api/leaderboard/stats ───────────────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const difficulty = req.query.difficulty;
    if (typeof difficulty !== 'string' || !VALID_DIFFICULTIES.includes(difficulty as Difficulty)) {
      return res.status(400).json({ error: 'Choose a difficulty' });
    }
    const stats = await getStats(difficulty as Difficulty);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
