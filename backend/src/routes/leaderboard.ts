/**
 * Leaderboard endpoint router.
 * Handles retrieving top scores and submitting new winning scores.
 */
import express from 'express';
import type { Request, Response } from 'express';
import pool from '../db/connection.js';

const router = express.Router();

/** Safely extract a message string from an unknown catch value. */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * GET /api/leaderboard
 * Retrieve top scores from the leaderboard
 * 
 * Query parameters:
 * - limit: Number of results to return (default: 10, max: 100)
 * - targetWord: Optional filter by specific target word
 * 
 * Response:
 * - leaderboard: Array of top scoring entries
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 100);
    const { targetWord } = req.query;
    
    let query = `
      SELECT 
        id,
        player_name,
        token_count,
        target_word,
        completed_at,
        session_id
      FROM leaderboard
    `;
    
    const params: any[] = [];
    
    // Add target word filter if provided
    if (targetWord) {
      query += ' WHERE target_word = ?';
      params.push(targetWord);
    }
    
    // Order by lowest token count (fewer tokens = better score).
    // LIMIT is inlined as a safe integer (already clamped 1-100 above) because
    // mysql2 prepared statements require numeric LIMIT params to be integers,
    // which pool.execute does not guarantee across all driver versions.
    query += ` ORDER BY token_count ASC, completed_at ASC LIMIT ${limit}`;
    
    const [rows] = await pool.execute(query, params);
    
    res.json({ 
      leaderboard: rows,
      count: (rows as any[]).length
    });
    
  } catch (error: unknown) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/leaderboard/rank/:tokenCount
 * Calculate what rank a given token count would achieve
 * 
 * Response:
 * - rank: The position this score would achieve
 * - total: Total number of entries
 * - percentile: Percentile ranking (0-100)
 */
router.get('/rank/:tokenCount', async (req: Request, res: Response) => {
  try {
    const tokenCount = parseInt(req.params.tokenCount || '0', 10);
    
    if (isNaN(tokenCount) || tokenCount < 0) {
      return res.status(400).json({ error: 'Invalid token count' });
    }
    
    // Single query returns both the rank and the total in one round-trip.
    // rank  = number of entries with a strictly lower token count + 1
    // total = total number of leaderboard entries
    const [rankRows] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM leaderboard WHERE token_count <= ?) AS better_or_equal,
         (SELECT COUNT(*) FROM leaderboard)                         AS total`,
      [tokenCount]
    );

    const row = (rankRows as any[])[0];
    const rank = row.better_or_equal + 1;
    const total = row.total;
    const percentile = total > 0 ? Math.round((1 - (rank / total)) * 100) : 0;
    
    res.json({ 
      rank,
      total,
      percentile
    });
    
  } catch (error: unknown) {
    console.error('Error calculating rank:', error);
    res.status(500).json({ 
      error: 'Failed to calculate rank',
      message: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/leaderboard
 * Submit a new winning score to the leaderboard
 * 
 * Request body:
 * - playerName: Name of the player
 * - tokenCount: Number of tokens used in the game
 * - targetWord: The target word that was achieved
 * - sessionId: Optional game session ID
 * 
 * Response:
 * - success: Boolean indicating success
 * - id: Database ID of the new entry
 * - rank: Position on the leaderboard
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { playerName, tokenCount, targetWord, sessionId } = req.body;
    
    // Validation
    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
      return res.status(400).json({ error: 'playerName is required and must be a non-empty string' });
    }
    
    if (!tokenCount || typeof tokenCount !== 'number' || tokenCount < 0) {
      return res.status(400).json({ error: 'tokenCount is required and must be a positive number' });
    }
    
    if (!targetWord || typeof targetWord !== 'string') {
      return res.status(400).json({ error: 'targetWord is required and must be a string' });
    }
    
    // Sanitize player name (max 255 chars, trim whitespace)
    const sanitizedName = playerName.trim().substring(0, 255);

    // Anti-cheat: if a sessionId is provided, ensure the session has not already
    // had its score submitted (prevents reloading a won session to double-submit).
    if (sessionId) {
      const [sessionRows] = await pool.execute(
        'SELECT score_submitted FROM game_sessions WHERE id = ?',
        [sessionId]
      );
      const session = (sessionRows as any[])[0];
      if (session?.score_submitted) {
        return res.status(409).json({ error: 'Score already submitted for this session' });
      }
    }

    // Insert into leaderboard
    const [result] = await pool.execute(
      'INSERT INTO leaderboard (player_name, token_count, target_word, session_id) VALUES (?, ?, ?, ?)',
      [sanitizedName, tokenCount, targetWord, sessionId || null]
    );
    
    const insertId = (result as any).insertId;

    // Mark the session as scored so it cannot be submitted again
    if (sessionId) {
      await pool.execute(
        'UPDATE game_sessions SET score_submitted = TRUE WHERE id = ?',
        [sessionId]
      );
    }    // Calculate rank: number of entries with a strictly lower token count, + 1.
    // Ties are ordered by insertion time (lower id = earlier = better), so this
    // entry beats others with the same token count that were inserted after it.
    const [rankResult] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM leaderboard WHERE token_count < ?) + 1 AS \`rank\``,
      [tokenCount]
    );
    
    const rank = (rankResult as any[])[0].rank;
    
    res.status(201).json({ 
      success: true,
      id: insertId,
      rank,
      message: `Score submitted successfully! You ranked #${rank}`
    });
    
  } catch (error: unknown) {
    console.error('Error submitting to leaderboard:', error);
    res.status(500).json({ 
      error: 'Failed to submit score',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/leaderboard/stats
 * Get leaderboard statistics
 * 
 * Response:
 * - totalGames: Total number of completed games
 * - averageTokens: Average tokens used
 * - bestScore: Lowest token count
 * - popularWords: Most common target words
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get aggregate statistics
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_games,
        AVG(token_count) as avg_tokens,
        MIN(token_count) as best_score,
        MAX(token_count) as worst_score
      FROM leaderboard
    `);
    
    // Get most popular target words
    const [popularWords] = await pool.execute(`
      SELECT target_word, COUNT(*) as count
      FROM leaderboard
      GROUP BY target_word
      ORDER BY count DESC
      LIMIT 5
    `);
    
    const statistics = (stats as any[])[0];
    
    res.json({
      totalGames: statistics.total_games,
      averageTokens: Math.round(statistics.avg_tokens || 0),
      bestScore: statistics.best_score || 0,
      worstScore: statistics.worst_score || 0,
      popularWords: popularWords
    });
    
  } catch (error: unknown) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: getErrorMessage(error),
    });
  }
});

export default router;
