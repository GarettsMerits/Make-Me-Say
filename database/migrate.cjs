// Run with: node database/migrate.js
const mysql = require("z:/Projects/dont-make-me-say/backend/node_modules/mysql2/promise");

const config = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "dont_make_me_say",
  multipleStatements: true,
};

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, table, index) {
  const [rows] = await conn.execute(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
    [table, index]
  );
  return rows.length > 0;
}

async function run() {
  const conn = await mysql.createConnection(config);
  console.log("Connected.");

  const steps = [
    {
      desc: "leaderboard.difficulty",
      check: () => columnExists(conn, "leaderboard", "difficulty"),
      sql: "ALTER TABLE leaderboard ADD COLUMN difficulty ENUM('easy','normal','hard','nightmare') NOT NULL DEFAULT 'normal' AFTER target_word",
    },
    {
      desc: "leaderboard.llm_victory_message",
      check: () => columnExists(conn, "leaderboard", "llm_victory_message"),
      sql: "ALTER TABLE leaderboard ADD COLUMN llm_victory_message TEXT AFTER difficulty",
    },
    {
      desc: "leaderboard idx_difficulty",
      check: () => indexExists(conn, "leaderboard", "idx_difficulty"),
      sql: "ALTER TABLE leaderboard ADD INDEX idx_difficulty (difficulty)",
    },
    {
      desc: "leaderboard idx_diff_tokens (composite)",
      check: () => indexExists(conn, "leaderboard", "idx_diff_tokens"),
      sql: "ALTER TABLE leaderboard ADD INDEX idx_diff_tokens (difficulty, token_count)",
    },
    {
      desc: "game_sessions.difficulty",
      check: () => columnExists(conn, "game_sessions", "difficulty"),
      sql: "ALTER TABLE game_sessions ADD COLUMN difficulty ENUM('easy','normal','hard','nightmare') NOT NULL DEFAULT 'normal' AFTER target_word",
    },
    {
      desc: "target_words: expand ENUM to include normal alongside medium",
      check: async () => !(await columnExists(conn, "target_words", "difficulty_level")),
      sql: "ALTER TABLE target_words MODIFY COLUMN difficulty_level ENUM('easy','medium','normal','hard','nightmare') NOT NULL DEFAULT 'normal'",
    },
    {
      desc: "target_words: map medium -> normal",
      check: async () => !(await columnExists(conn, "target_words", "difficulty_level")),
      sql: "UPDATE target_words SET difficulty_level = 'normal' WHERE difficulty_level = 'medium'",
    },
    {
      desc: "target_words: rename difficulty_level -> difficulty",
      check: async () => !(await columnExists(conn, "target_words", "difficulty_level")),
      sql: "ALTER TABLE target_words CHANGE COLUMN difficulty_level difficulty ENUM('easy','normal','hard','nightmare') NOT NULL DEFAULT 'normal'",
    },
    {
      desc: "target_words.assignment_count",
      check: () => columnExists(conn, "target_words", "assignment_count"),
      sql: "ALTER TABLE target_words ADD COLUMN assignment_count INT NOT NULL DEFAULT 0 AFTER is_active",
    },
    {
      desc: "target_words.reroll_count",
      check: () => columnExists(conn, "target_words", "reroll_count"),
      sql: "ALTER TABLE target_words ADD COLUMN reroll_count INT NOT NULL DEFAULT 0 AFTER assignment_count",
    },
    {
      desc: "target_words.total_games_played",
      check: () => columnExists(conn, "target_words", "total_games_played"),
      sql: "ALTER TABLE target_words ADD COLUMN total_games_played INT NOT NULL DEFAULT 0 AFTER reroll_count",
    },
    {
      desc: "target_words.win_count",
      check: () => columnExists(conn, "target_words", "win_count"),
      sql: "ALTER TABLE target_words ADD COLUMN win_count INT NOT NULL DEFAULT 0 AFTER total_games_played",
    },
    {
      desc: "target_words.avg_tokens_to_win",
      check: () => columnExists(conn, "target_words", "avg_tokens_to_win"),
      sql: "ALTER TABLE target_words ADD COLUMN avg_tokens_to_win DECIMAL(10,2) DEFAULT NULL AFTER win_count",
    },
    {
      desc: "target_words.max_tokens_to_win",
      check: () => columnExists(conn, "target_words", "max_tokens_to_win"),
      sql: "ALTER TABLE target_words ADD COLUMN max_tokens_to_win INT DEFAULT NULL AFTER avg_tokens_to_win",
    },
    {
      desc: "target_words.min_tokens_to_win",
      check: () => columnExists(conn, "target_words", "min_tokens_to_win"),
      sql: "ALTER TABLE target_words ADD COLUMN min_tokens_to_win INT DEFAULT NULL AFTER max_tokens_to_win",
    },
  ];

  for (const step of steps) {
    const alreadyDone = await step.check();
    if (alreadyDone) {
      console.log(`  SKIP  ${step.desc}`);
    } else {
      await conn.execute(step.sql);
      console.log(`  DONE  ${step.desc}`);
    }
  }

  await conn.end();
  console.log("\nMigration complete.");
}

run().catch((err) => { console.error(err); process.exit(1); });



