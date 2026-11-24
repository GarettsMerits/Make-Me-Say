import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TargetWordMatcher } from './TargetWordMatcher.js';

describe('TargetWordMatcher', () => {
  const banana = new TargetWordMatcher('Banana');

  it('matches a whole word regardless of case', () => {
    assert.equal(banana.appearsIn('I said banana.'), true);
    assert.equal(banana.appearsIn('BANANA'), true);
  });

  it('does not match a longer word that merely contains the letters', () => {
    assert.equal(banana.appearsIn('bananas'), false);
    assert.equal(new TargetWordMatcher('cat').appearsIn('category'), false);
  });

  it('splits only whole-word hits', () => {
    const parts = new TargetWordMatcher('cat').split('the cat in category');
    assert.deepEqual(
      parts.filter((part) => part.isMatch).map((part) => part.text),
      ['cat'],
    );
  });
});
