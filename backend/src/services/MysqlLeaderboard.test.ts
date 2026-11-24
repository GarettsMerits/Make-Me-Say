import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MysqlLeaderboard, type SqlExecutor } from './MysqlLeaderboard.js';

function scripted(rows: unknown[][]): SqlExecutor & { calls: { sql: string; params: readonly unknown[] | undefined }[] } {
  const calls: { sql: string; params: readonly unknown[] | undefined }[] = [];
  return {
    calls,
    async execute(sql, params) {
      calls.push({ sql, params });
      return [rows[calls.length - 1] ?? [], []];
    },
  };
}

describe('MysqlLeaderboard', () => {
  it('turns a strictly-lower count into a place, and reports the size of that board', async () => {
    const db = scripted([[{ better: 2, total: 5 }]]);
    const board = new MysqlLeaderboard(db);

    const place = await board.place(40, 'hard');

    assert.equal(db.calls.length, 1);
    assert.match(db.calls[0]!.sql, /token_count < \? AND difficulty = \?/);
    assert.deepEqual(db.calls[0]!.params, [40, 'hard', 'hard']);
    assert.equal(place.rank, 3);
    assert.equal(place.total, 5);
  });

  it('gives place 1 when nobody has a lower score', async () => {
    const db = scripted([[{ better: 0, total: 0 }]]);
    const place = await new MysqlLeaderboard(db).place(10, 'easy');
    assert.equal(place.rank, 1);
    assert.equal(place.total, 0);
  });

  it('reads a page in one query and shares a place when the lower-score counts match', async () => {
    const db = scripted([[
      { id: 1, player_name: 'Ada', token_count: 20, target_word: 'cat', difficulty: 'normal', llm_victory_message: 'cat', completed_at: 't1', session_id: 'a', better: 0 },
      { id: 2, player_name: 'Bea', token_count: 20, target_word: 'dog', difficulty: 'normal', llm_victory_message: 'dog', completed_at: 't2', session_id: 'b', better: 0 },
      { id: 3, player_name: 'Cy', token_count: 40, target_word: 'elk', difficulty: 'normal', llm_victory_message: 'elk', completed_at: 't3', session_id: 'c', better: 2 },
    ]]);
    const page = await new MysqlLeaderboard(db).page('normal', 2, 0);

    assert.equal(db.calls.length, 1);
    assert.match(db.calls[0]!.sql, /better\.token_count < l\.token_count AND better\.difficulty = l\.difficulty/);
    assert.match(db.calls[0]!.sql, /ORDER BY l\.token_count ASC, l\.completed_at ASC/);
    assert.match(db.calls[0]!.sql, /LIMIT 3 OFFSET 0/);
    assert.equal(page.entries.length, 2);
    assert.equal(page.entries[0]!.rank, 1);
    assert.equal(page.entries[1]!.rank, 1);
    assert.equal(page.hasMore, true);
    assert.equal('better' in page.entries[0]!, false);
  });

  it('clamps the page so the inlined limit and offset stay integers inside range', async () => {
    const db = scripted([[]]);
    await new MysqlLeaderboard(db).page('nightmare', 10_000, -4);
    assert.match(db.calls[0]!.sql, /LIMIT 101 OFFSET 0/);
  });
});
