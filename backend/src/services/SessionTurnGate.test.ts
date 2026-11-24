import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SessionTurnGate } from './SessionTurnGate.js';

describe('SessionTurnGate', () => {
  it('allows one turn and refuses a second until release', () => {
    const gate = new SessionTurnGate();
    assert.equal(gate.tryAcquire('game-a'), true);
    assert.equal(gate.tryAcquire('game-a'), false);
    assert.equal(gate.tryAcquire('game-b'), true);
    gate.release('game-a');
    assert.equal(gate.tryAcquire('game-a'), true);
  });

  it('release of an idle session does not block the next acquire', () => {
    const gate = new SessionTurnGate();
    gate.release('missing');
    assert.equal(gate.tryAcquire('missing'), true);
  });
});