import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseStoredMessages, PlayerScore } from './PlayerScore.js';

describe('PlayerScore', () => {
  const messages = [
    { sender: 'user' as const, text: 'hello', tokenCount: 2 },
    { sender: 'llm' as const, text: 'nope', tokenCount: 40 },
    { sender: 'user' as const, text: 'again', tokenCount: 3 },
    { sender: 'llm' as const, text: 'fine, banana', tokenCount: 10 },
    { sender: 'llm' as const, text: 'I said banana again', tokenCount: 8 },
  ];

  it('counts only the player messages', () => {
    assert.equal(new PlayerScore(messages).tokenCount, 5);
  });

  it('uses the first model reply that contains the word, not the loss reply', () => {
    assert.equal(new PlayerScore(messages).victoryMessage('banana'), 'fine, banana');
  });

  it('parses a JSON string or an already-decoded array', () => {
    const raw = JSON.stringify(messages);
    assert.equal(parseStoredMessages(raw).length, 5);
    assert.equal(parseStoredMessages(messages).length, 5);
    assert.deepEqual(parseStoredMessages('not-json'), []);
  });
});
