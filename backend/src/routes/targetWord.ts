/**
 * Target word endpoint router.
 * Provides functionality to retrieve a random target word for a new game session.
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
 * GET /api/target-word
 * Returns a random active target word from the database
 * 
 * Query parameters:
 * - difficulty: Optional filter by difficulty level (easy, medium, hard)
 * 
 * Response:
 * - word: The target word string
 * - difficulty: Difficulty level of the word
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { difficulty } = req.query;
    
    let query = 'SELECT id, word, difficulty_level FROM target_words WHERE is_active = TRUE';
    const params: any[] = [];
    
    // Add difficulty filter if provided
    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty as string)) {
      query += ' AND difficulty_level = ?';
      params.push(difficulty);
    }
    
    // Order randomly and take one
    query += ' ORDER BY RAND() LIMIT 1';
    
    const [rows] = await pool.execute(query, params);
    const words = rows as any[];
    
    if (words.length === 0) {
      return res.status(404).json({ 
        error: 'No target words available',
        message: 'Please contact administrator to add target words to the database'
      });
    }
    
    const targetWord = words[0];
    
    res.json({
      id: targetWord.id,
      word: targetWord.word,
      difficulty: targetWord.difficulty_level
    });
    
  } catch (error: unknown) {
    console.error('Error fetching target word:', error);
    res.status(500).json({ 
      error: 'Failed to fetch target word',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/target-word/list
 * Returns all available target words (for admin/testing purposes)
 * 
 * Response:
 * - words: Array of word objects with word, difficulty, and active status
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      'SELECT word, difficulty_level, is_active FROM target_words ORDER BY difficulty_level, word'
    );
    
    res.json({ words: rows });
    
  } catch (error: any) {
    console.error('Error listing target words:', error);
    res.status(500).json({ 
      error: 'Failed to list target words',
      message: error.message 
    });
  }
});

export default router;
