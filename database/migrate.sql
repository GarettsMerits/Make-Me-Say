-- Migration: apply schema changes to existing dont_make_me_say database
-- Run via: node database/migrate.cjs
USE dont_make_me_say;

DROP PROCEDURE IF EXISTS migrate_schema;

DELIMITER $$
CREATE PROCEDURE migrate_schema()
BEGIN

  -- leaderboard: add difficulty
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'leaderboard' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE leaderboard ADD COLUMN difficulty ENUM('easy','normal','hard','nightmare') NOT NULL DEFAULT 'normal' AFTER target_word;
  END IF;

  -- leaderboard: add llm_victory_message
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'leaderboard' AND column_name = 'llm_victory_message'
  ) THEN
    ALTER TABLE leaderboard ADD COLUMN llm_victory_message TEXT AFTER difficulty;
  END IF;

  -- leaderboard: add idx_difficulty index
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'leaderboard' AND index_name = 'idx_difficulty'
  ) THEN
    ALTER TABLE leaderboard ADD INDEX idx_difficulty (difficulty);
  END IF;

  -- game_sessions: add difficulty
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'game_sessions' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN difficulty ENUM('easy','normal','hard','nightmare') NOT NULL DEFAULT 'normal' AFTER target_word;
  END IF;

  -- target_words: rename difficulty_level to difficulty
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'difficulty_level'
  ) THEN
    ALTER TABLE target_words CHANGE COLUMN difficulty_level difficulty ENUM('easy','normal','hard','nightmare') NOT NULL DEFAULT 'normal';
  END IF;

  -- target_words: add assignment_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'assignment_count'
  ) THEN
    ALTER TABLE target_words ADD COLUMN assignment_count INT NOT NULL DEFAULT 0 AFTER is_active;
  END IF;

  -- target_words: add reroll_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'reroll_count'
  ) THEN
    ALTER TABLE target_words ADD COLUMN reroll_count INT NOT NULL DEFAULT 0 AFTER assignment_count;
  END IF;

  -- target_words: add total_games_played
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'total_games_played'
  ) THEN
    ALTER TABLE target_words ADD COLUMN total_games_played INT NOT NULL DEFAULT 0 AFTER reroll_count;
  END IF;

  -- target_words: add win_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'win_count'
  ) THEN
    ALTER TABLE target_words ADD COLUMN win_count INT NOT NULL DEFAULT 0 AFTER total_games_played;
  END IF;

  -- target_words: add avg_tokens_to_win
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'avg_tokens_to_win'
  ) THEN
    ALTER TABLE target_words ADD COLUMN avg_tokens_to_win DECIMAL(10,2) DEFAULT NULL AFTER win_count;
  END IF;

  -- target_words: add max_tokens_to_win
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'max_tokens_to_win'
  ) THEN
    ALTER TABLE target_words ADD COLUMN max_tokens_to_win INT DEFAULT NULL AFTER avg_tokens_to_win;
  END IF;

  -- target_words: add min_tokens_to_win
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'target_words' AND column_name = 'min_tokens_to_win'
  ) THEN
    ALTER TABLE target_words ADD COLUMN min_tokens_to_win INT DEFAULT NULL AFTER max_tokens_to_win;
  END IF;

  -- game_sessions: score can be recorded only once
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'game_sessions' AND column_name = 'score_submitted'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN score_submitted BOOLEAN NOT NULL DEFAULT FALSE AFTER completed;
  END IF;

  -- game_sessions: a decline keeps the conversation and refuses a later commit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'game_sessions' AND column_name = 'declined'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN declined BOOLEAN NOT NULL DEFAULT FALSE AFTER score_submitted;
  END IF;

  -- leaderboard: link a row to the session that produced it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'leaderboard' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE leaderboard ADD COLUMN session_id VARCHAR(255) NULL AFTER completed_at;
  END IF;

  -- leaderboard: one score row per session (multiple NULLs stay allowed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'leaderboard' AND index_name = 'uniq_leaderboard_session'
  ) THEN
    ALTER TABLE leaderboard ADD UNIQUE KEY uniq_leaderboard_session (session_id);
  END IF;

  -- leaderboard: composite lookup used by per-difficulty rank
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'leaderboard' AND index_name = 'idx_diff_tokens'
  ) THEN
    ALTER TABLE leaderboard ADD INDEX idx_diff_tokens (difficulty, token_count);
  END IF;

END$$
DELIMITER ;

CALL migrate_schema();
DROP PROCEDURE IF EXISTS migrate_schema;

SELECT 'Migration complete.' AS status;
