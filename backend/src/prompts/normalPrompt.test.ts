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

  it('asks for a snarky conversation and does not admit a game', () => {
    const prompt = buildNormalPrompt('banana');
    assert.match(prompt, /Your job is the conversation/);
    assert.match(prompt, /taunting, snarky, cocky/);
    assert.match(prompt, /Answer the substance/);
    assert.doesNotMatch(prompt, /word game/i);
    assert.doesNotMatch(prompt, /opponent/);
    assert.doesNotMatch(prompt, /deflect or respond with a non-answer/);
    assert.doesNotMatch(prompt, /Don't let the user win/);
  });
});