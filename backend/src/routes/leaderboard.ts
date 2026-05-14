/**
 * Leaderboard route
 *
 * Handles input validation and HTTP responses only.
 * All database logic lives in services/leaderboardService.ts.
 */
import express from 'express';
import type { Request, Response } from 'express';
import {
  getEntries,
  getRank,
  isScoreAlreadySubmitted,
  submitEntry,
  getStats,
} from '../services/leaderboardService.js';

const router = express.Router();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ─── GET /api/leaderboard ─────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit      = Math.min(parseInt(req.query.limit as string, 10) || 10, 100);
    const targetWord = req.query.targetWord as string | undefined;

    const entries = await getEntries(limit, targetWord);
    res.json({ leaderboard: entries, count: entries.length });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard', message: getErrorMessage(error) });
  }
});

// ─── GET /api/leaderboard/rank/:tokenCount ────────────────────────────────────

router.get('/rank/:tokenCount', async (req: Request, res: Response) => {
  try {
    const tokenCount = parseInt(req.params.tokenCount ?? '0', 10);
    if (isNaN(tokenCount) || tokenCount < 0) {
      return res.status(400).json({ error: 'Invalid token count' });
    }

    const result = await getRank(tokenCount);
    res.json(result);
  } catch (error) {
    console.error('Error calculating rank:', error);
    res.status(500).json({ error: 'Failed to calculate rank', message: getErrorMessage(error) });
  }
});

// ─── POST /api/leaderboard ────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const { playerName, tokenCount, targetWord, sessionId } = req.body;

    // Validation
    if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
      return res.status(400).json({ error: 'playerName is required and must be a non-empty string' });
    }
    if (typeof tokenCount !== 'number' || tokenCount < 0) {
      return res.status(400).json({ error: 'tokenCount is required and must be a non-negative number' });
    }
    if (!targetWord || typeof targetWord !== 'string') {
      return res.status(400).json({ error: 'targetWord is required and must be a string' });
    }

    const sanitizedName = playerName.trim().substring(0, 255);

    // Anti-cheat: reject duplicate submissions for the same session
    if (sessionId) {
      const alreadySubmitted = await isScoreAlreadySubmitted(sessionId);
      if (alreadySubmitted) {
        return res.status(409).json({ error: 'Score already submitted for this session' });
      }
    }

    const { id, rank } = await submitEntry(sanitizedName, tokenCount, targetWord, sessionId ?? null);

    res.status(201).json({
      success: true,
      id,
      rank,
      message: `Score submitted successfully! You ranked #${rank}`,
    });
  } catch (error) {
    console.error('Error submitting to leaderboard:', error);
    res.status(500).json({ error: 'Failed to submit score', message: getErrorMessage(error) });
  }
});

// ─── GET /api/leaderboard/stats ───────────────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics', message: getErrorMessage(error) });
  }
});

export default router;
