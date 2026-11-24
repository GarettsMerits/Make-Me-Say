import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TargetWordMatcher } from '../domain/TargetWordMatcher.js';
import { modelLine, playerLine, replyForTurn } from './wordLines.js';

const target = 'banana';
const matcher = new TargetWordMatcher(target);

function copiesIn(text: string): number {
  return matcher.split(text).filter((part) => part.isMatch).length;
}

describe('simulated lines', () => {
  it('keeps the target word out of the player line', () => {
    const line = playerLine(target, () => 0);
    assert.equal(matcher.appearsIn(line), false);
    assert.ok(line.split(' ').length >= 2);
  });

  it('inserts the requested number of copies, including one tight against punctuation', () => {
    const punctuated = modelLine(target, 3, () => 0.9);
    assert.equal(copiesIn(punctuated), 3);
    assert.match(punctuated, /banana!/);

    const plain = modelLine(target, 2, () => 0);
    assert.equal(copiesIn(plain), 2);
    assert.doesNotMatch(plain, /banana!/);
  });

  it('withholds the target until a later reply, then emits one or more copies', () => {
    const stingy = () => 0.99;
    for (let turn = 1; turn < 6; turn += 1) {
      assert.equal(matcher.appearsIn(replyForTurn(target, turn, stingy)), false);
    }
    const winning = replyForTurn(target, 6, stingy);
    const copies = copiesIn(winning);
    assert.ok(copies >= 1 && copies <= 3);
  });
});
