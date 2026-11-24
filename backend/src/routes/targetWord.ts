/**
 * Target word endpoint router.
 * Provides functionality to retrieve a random target word for a new game session.
 */
import express from 'express';
import type { Request, Response } from 'express';
import pool from '../db/connection.js';
import { VALID_DIFFICULTIES, type Difficulty } from '../types.js';

const router = express.Router();

/**
 * GET /api/target-word
 * Returns a random active target word from the database.
 *
 * Query parameters:
 * - difficulty: Optional filter  E'easy' | 'normal' | 'hard' | 'nightmare'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { difficulty } = req.query;

    const diffParam = difficulty && VALID_DIFFICULTIES.includes(difficulty as Difficulty)
      ? (difficulty as Difficulty)
      : null;

    const diffClause = diffParam ? ' AND difficulty = ?' : '';
    const baseParams: any[] = diffParam ? [diffParam] : [];

    // Count eligible rows then pick a random OFFSET — works correctly regardless of id gaps
    const [[countRow]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM target_words WHERE is_active = TRUE${diffClause}`,
      baseParams,
    ) as any;
    const total: number = Math.trunc(Number(countRow?.total ?? 0));

    if (total === 0) {
      return res.status(404).json({
        error: 'No target words available',
        message: 'Please run the seed script to add target words to the database',
      });
    }

    // OFFSET cannot be a bound parameter in mysql2 prepared statements (ER_WRONG_ARGUMENTS).
    // The value is a safe integer we computed ourselves, so inlining it is fine.
    const offset = Math.trunc(Math.random() * total);

    const [rows] = await pool.execute(
      `SELECT id, word, difficulty FROM target_words
       WHERE is_active = TRUE${diffClause}
       ORDER BY id LIMIT 1 OFFSET ${offset}`,
      baseParams,
    ) as any;
    const words = rows as any[];

    const targetWord = words[0];

    // Fire-and-forget: increment assignment counter
    pool.execute(
      'UPDATE target_words SET assignment_count = assignment_count + 1 WHERE id = ?',
      [targetWord.id],
    ).catch((err) => console.warn('Could not increment assignment_count:', err));

    res.json({
      id: targetWord.id,
      word: targetWord.word,
      difficulty: targetWord.difficulty,
    });
  } catch (error: unknown) {
    console.error('Error fetching target word:', error);
    res.status(500).json({ error: 'Failed to fetch target word' });
  }
});

/**
 * POST /api/target-word/reroll
 * Records that a player rerolled away from a word without sending any messages.
 *
 * Body: { targetWordId: number }
 */
router.post('/reroll', async (req: Request, res: Response) => {
  try {
    const { targetWordId } = req.body;

    const parsedId = parseInt(String(targetWordId), 10);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: 'targetWordId must be a positive integer' });
    }

    const [result] = await pool.execute(
      'UPDATE target_words SET reroll_count = reroll_count + 1 WHERE id = ? AND is_active = TRUE',
      [parsedId],
    );
    if (Number((result as { affectedRows?: number }).affectedRows ?? 0) === 0) {
      return res.status(404).json({ error: 'Target word not found' });
    }

    res.json({ success: true });
  } catch (error: unknown) {
    console.error('Error recording reroll:', error);
    res.status(500).json({ error: 'Failed to record reroll' });
  }
});

/**
 * GET /api/target-word/list
 * Returns all available target words.
 * Off unless ENABLE_WORD_LIST=true. NODE_ENV=development is not enough,
 * because that is the local default and would publish every answer.
 */
router.get('/list', async (req: Request, res: Response) => {
  if (process.env.ENABLE_WORD_LIST !== 'true') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT word, difficulty, is_active FROM target_words ORDER BY difficulty, word',
    );
    res.json({ words: rows });
  } catch (error: unknown) {
    console.error('Error listing target words:', error);
    res.status(500).json({ error: 'Failed to list target words' });
  }
});

export default router;
