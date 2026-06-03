/**
 * Seed script — populates the target_words table from the word CSV files.
 *
 * Usage (from the backend directory):
 *   npx ts-node --esm scripts/seedWords.ts
 *   -- or --
 *   node --loader ts-node/esm scripts/seedWords.ts
 *
 * Each CSV file (words/<difficulty>.csv) must have a single column named "word".
 * Words are inserted or ignored on duplicate to allow re-running safely.
 * The script also re-activates any words that were previously deactivated.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORDS_DIR  = path.resolve(__dirname, '../words');

type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

function readWords(difficulty: Difficulty): string[] {
  const filePath = path.join(WORDS_DIR, `${difficulty}.csv`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠  Missing file: ${filePath} — skipping`);
    return [];
  }

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  // Skip header row ("word"), blank lines, and duplicates
  const words = [...new Set(
    lines
      .slice(1)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean),
  )].sort();

  return words;
}

async function seed(): Promise<void> {
  console.log('🌱  Seeding target_words table…\n');

  for (const difficulty of DIFFICULTIES) {
    const words = readWords(difficulty);
    if (words.length === 0) continue;

    console.log(`  ${difficulty.toUpperCase()} — ${words.length} words`);

    let inserted = 0;
    let skipped  = 0;

    for (const word of words) {
      try {
        const [result] = await pool.execute(
          `INSERT INTO target_words (word, difficulty, is_active)
           VALUES (?, ?, TRUE)
           ON DUPLICATE KEY UPDATE difficulty = VALUES(difficulty), is_active = TRUE`,
          [word, difficulty],
        ) as any[];
        if (result.affectedRows === 1) inserted++;
        else skipped++;
      } catch (err) {
        console.error(`    ✗  Failed to insert "${word}":`, err);
      }
    }

    console.log(`    ✓  ${inserted} inserted / ${skipped} already present\n`);
  }

  console.log('✅  Seeding complete.');
  await (pool as any).end();
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
