import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildNormalPrompt } from './normalPrompt.js';

describe('buildNormalPrompt', () => {
  it('forbids disguising the target word instead of inviting misspellings', () => {
    const prompt = buildNormalPrompt('banana');
    assert.match(prompt, /Do not disguise "banana"/);
    assert.match(prompt, /correctly spelled, grammatically correct English/);
    assert.doesNotMatch(prompt, /You may use spelling errors/);
  });
});