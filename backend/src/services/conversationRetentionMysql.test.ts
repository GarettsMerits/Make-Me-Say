import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Pool } from 'mysql2/promise';
import { mysqlConversationRetention } from './conversationRetentionMysql.js';

/**
 * Records the statements the adapter sends. Each queued value is the first
 * element of the driver's result: a row list for a read, or a header for a write.
 */
function recordingPool(results: unknown[]): { pool: Pool; sqls: string[] } {
  const sqls: string[] = [];
  const pool = {
    async query(sql: string) {
      const next = results[sqls.length];
      sqls.push(sql);
      return [next, []];
    },
  };
  return { pool: pool as unknown as Pool, sqls };
}

function statement(sqls: string[], pattern: RegExp): string {
  const found = sqls.find((sql) => pattern.test(sql));
  assert.ok(found, `missing statement ${pattern}`);
  return found;
}

describe('mysql conversation retention', () => {
  it('deletes only an ended round that was not declined and has no leaderboard entry', async () => {
    const { pool, sqls } = recordingPool([
      [{ bytes: 2_000 }],
      { affectedRows: 1 },
      [],
      [{ bytes: 10 }],
    ]);

    const removed = await mysqlConversationRetention(pool, 1_000).enforce();

    assert.equal(removed, 1);
    const deleted = statement(sqls, /^DELETE FROM game_sessions/i);
    assert.match(deleted, /lb\.session_id IS NULL/);
    assert.match(deleted, /gs\.declined = FALSE/);
    assert.match(deleted, /gs\.completed = TRUE/);
    assert.match(deleted, /INTERVAL 15 MINUTE/);
    assert.equal(sqls.some((sql) => /DELETE\s+FROM\s+leaderboard/i.test(sql)), false);
  });

  it('strips a recorded conversation only after every remaining session has an entry', async () => {
    const { pool, sqls } = recordingPool([
      [{ bytes: 2_000 }],
      { affectedRows: 0 },
      [{ only_recorded: 1 }],
      { affectedRows: 2 },
      [],
      [{ bytes: 10 }],
    ]);

    const removed = await mysqlConversationRetention(pool, 1_000).enforce();

    assert.equal(removed, 2);
    const gate = statement(sqls, /NOT EXISTS/i);
    assert.match(gate, /LEFT JOIN leaderboard/);
    assert.match(gate, /lb\.session_id IS NULL/);

    const stripped = statement(sqls, /^UPDATE game_sessions/i);
    assert.match(stripped, /INNER JOIN leaderboard/);
    assert.match(stripped, /llm_victory_message/);
    assert.match(stripped, /'sender', 'llm'/);
    assert.match(stripped, /INTERVAL 15 MINUTE/);
    assert.equal(sqls.some((sql) => /DELETE\s+FROM\s+leaderboard/i.test(sql)), false);
  });
});
