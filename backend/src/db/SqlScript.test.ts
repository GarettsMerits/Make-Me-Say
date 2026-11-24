import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SqlScript } from './SqlScript.js';

describe('SqlScript', () => {
  it('splits on semicolons between statements', () => {
    const script = new SqlScript('CREATE TABLE a (id INT);\nCREATE TABLE b (id INT);');
    assert.deepEqual(script.statements(), [
      'CREATE TABLE a (id INT)',
      'CREATE TABLE b (id INT)',
    ]);
  });

  it('keeps a semicolon that is inside a string or a comment', () => {
    const script = new SqlScript(`
      -- a note; not a statement
      INSERT INTO t (note) VALUES ('a;b');
      /* block; comment */
      SELECT 1;
    `);
    assert.deepEqual(script.statements(), [
      "INSERT INTO t (note) VALUES ('a;b')",
      'SELECT 1',
    ]);
  });
});