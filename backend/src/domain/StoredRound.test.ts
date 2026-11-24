import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readStoredRound } from './StoredRound.js';

const countTokens = (text: string) => text.length;

describe('readStoredRound', () => {
  it('keeps the score unlocked when the player is the one who says the word', () => {
    const answers = readStoredRound({
      targetWord: 'banana',
      difficulty: 'normal',
      countTokens,
      messages: [
        { sender: 'user', text: 'banana', tokenCount: 4 },
        { sender: 'llm', text: 'nice try' },
      ],
    });

    assert.equal(answers.locked, false);
    assert.equal(answers.thisReplyWon, false);
    assert.equal(answers.canCommit, false);
    assert.equal(answers.score, null);
    assert.equal(answers.winningReply, null);
    assert.equal(answers.figure, 4);
  });

  it('locks on the last model reply, including punctuation tight against the word', () => {
    const answers = readStoredRound({
      targetWord: 'banana',
      difficulty: 'normal',
      countTokens,
      messages: [
        { sender: 'user', text: 'hi', tokenCount: 5 },
        { sender: 'llm', text: 'banana!' },
      ],
    });

    assert.equal(answers.locked, true);
    assert.equal(answers.thisReplyWon, true);
    assert.equal(answers.canCommit, true);
    assert.equal(answers.score, 5);
    assert.equal(answers.winningReply, 'banana!');
    assert.equal(answers.figure, 5);
  });

  it('does not treat a later copy of the winning text as the reply that won', () => {
    const answers = readStoredRound({
      targetWord: 'banana',
      difficulty: 'hard',
      countTokens,
      messages: [
        { sender: 'user', text: 'hi', tokenCount: 5 },
        { sender: 'llm', text: 'banana' },
        { sender: 'user', text: 'again', tokenCount: 9 },
        { sender: 'llm', text: 'banana' },
      ],
    });

    assert.equal(answers.locked, true);
    assert.equal(answers.thisReplyWon, false);
    assert.equal(answers.score, 5);
    assert.equal(answers.winningReply, 'banana');
    assert.equal(answers.figure, 5);
  });

  it('refuses a commit after decline, an earlier commit, or reset, and still reports the score', () => {
    const messages = [
      { sender: 'user' as const, text: 'hi', tokenCount: 5 },
      { sender: 'llm' as const, text: 'banana' },
    ];
    const base = { targetWord: 'banana', difficulty: 'normal' as const, countTokens, messages };

    for (const flags of [
      { declined: true },
      { scoreSubmitted: true },
      { ended: true },
    ]) {
      const answers = readStoredRound({ ...base, ...flags });
      assert.equal(answers.canCommit, false);
      assert.equal(answers.locked, true);
      assert.equal(answers.score, 5);
      assert.equal(answers.winningReply, 'banana');
    }
  });

  it('counts a player message that has no stored token count', () => {
    const answers = readStoredRound({
      targetWord: 'banana',
      difficulty: 'easy',
      countTokens,
      messages: [
        { sender: 'user', text: 'hello' },
        { sender: 'llm', text: 'no' },
      ],
    });

    assert.equal(answers.figure, 'hello'.length);
    assert.equal(answers.locked, false);
  });
});
