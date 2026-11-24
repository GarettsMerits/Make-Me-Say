import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LineBuffer } from './LineBuffer.js';

describe('LineBuffer', () => {
  it('returns only complete lines and keeps the tail', () => {
    const buffer = new LineBuffer(100);
    assert.deepEqual(buffer.push('one\ntwo'), ['one']);
    assert.deepEqual(buffer.push('\nthree\n'), ['two', 'three']);
  });

  it('drops the pending text and throws once the cap is passed', () => {
    const buffer = new LineBuffer(4);
    assert.throws(() => buffer.push('abcde'), /line buffer exceeded/);
    assert.deepEqual(buffer.push('ok\n'), ['ok']);
  });
});