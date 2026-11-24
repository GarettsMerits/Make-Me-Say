/**
 * MySQL adapter for conversation retention.
 * Size is the engine's allocated data plus indexes for this schema.
 * A round touched in the last 15 minutes is left alone.
 * Leaderboard rows are never deleted.
 */
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { ConversationRetention } from './ConversationRetention.js';

const GRACE_MINUTES = 15;

function affected(result: ResultSetHeader): number {
  return Number(result.affectedRows ?? 0);
}

export function mysqlConversationRetention(pool: Pool, limitBytes: number): ConversationRetention {
  return new ConversationRetention(limitBytes, {
    async sizeBytes() {
      const [rows] = await pool.query(
        `SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes
           FROM information_schema.tables
          WHERE table_schema = DATABASE()`,
      );
      return Number((rows as { bytes: number }[])[0]?.bytes ?? 0);
    },

    async onlyRecordedRoundsRemain() {
      const [rows] = await pool.query(
        `SELECT NOT EXISTS (
           SELECT 1
             FROM game_sessions AS gs
             LEFT JOIN leaderboard AS lb ON lb.session_id = gs.id
            WHERE lb.session_id IS NULL
         ) AS only_recorded`,
      );
      return Number((rows as { only_recorded: number }[])[0]?.only_recorded ?? 0) === 1;
    },

    async deleteOldestUnrecorded(limit: number) {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM game_sessions
          WHERE id IN (
            SELECT id FROM (
              SELECT gs.id
                FROM game_sessions AS gs
                LEFT JOIN leaderboard AS lb ON lb.session_id = gs.id
               WHERE lb.session_id IS NULL
                 AND gs.declined = FALSE
                 AND gs.completed = TRUE
                 AND gs.last_activity < (NOW() - INTERVAL ${GRACE_MINUTES} MINUTE)
               ORDER BY gs.created_at ASC
               LIMIT ${safeLimit}
            ) AS oldest
          )`,
      );
      return affected(result);
    },

    async stripRecordedConversations(limit: number) {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE game_sessions AS gs
           INNER JOIN leaderboard AS lb ON lb.session_id = gs.id
            SET gs.messages = JSON_ARRAY(
                  JSON_OBJECT('sender', 'llm', 'text', IFNULL(lb.llm_victory_message, ''))
                )
          WHERE gs.id IN (
            SELECT id FROM (
              SELECT gs2.id
                FROM game_sessions AS gs2
                INNER JOIN leaderboard AS lb2 ON lb2.session_id = gs2.id
               WHERE gs2.last_activity < (NOW() - INTERVAL ${GRACE_MINUTES} MINUTE)
                 AND NOT (
                   JSON_TYPE(gs2.messages) = 'ARRAY'
                   AND JSON_LENGTH(gs2.messages) = 1
                 )
               ORDER BY gs2.created_at ASC
               LIMIT ${safeLimit}
            ) AS recorded
          )`,
      );
      return affected(result);
    },

    async reclaim() {
      await pool.query('OPTIMIZE TABLE game_sessions');
    },
  });
}
