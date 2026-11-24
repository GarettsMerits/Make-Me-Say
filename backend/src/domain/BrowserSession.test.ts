import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BrowserSession, InMemorySessionMemory, type WordDeck } from './BrowserSession.js';
import { InMemoryLeaderboard } from './InMemoryLeaderboard.js';
import type { TokenCounter } from './Round.js';

function counter(known: Record<string, number>): TokenCounter {
  return {
    count(text: string) {
      const value = known[text];
      if (value === undefined) throw new Error(`no known token count for ${JSON.stringify(text)}`);
      return value;
    },
  };
}

function deck(words: string[]): WordDeck {
  const queue = [...words];
  return { next: () => queue.shift() ?? 'fallback' };
}

function visit(options?: {
  browserId?: string;
  memory?: InMemorySessionMemory;
  words?: string[];
  leaderboard?: InMemoryLeaderboard;
}) {
  const memory = options?.memory ?? new InMemorySessionMemory();
  const leaderboard = options?.leaderboard ?? new InMemoryLeaderboard();
  const session = new BrowserSession({
    browserId: options?.browserId ?? 'this-browser',
    memory,
    leaderboard,
    words: deck(options?.words ?? ['apple', 'berry', 'cherry']),
    tokens: counter({ hi: 5, more: 4, banana: 40, nope: 40 }),
  });
  return { session, memory, leaderboard };
}

describe('BrowserSession', () => {
  it('deals a visible target word for the chosen difficulty', () => {
    const { session } = visit();
    session.signIn();

    const word = session.choose('easy');

    assert.equal(word, 'apple');
    assert.equal(session.shownWord(), 'apple');
    assert.equal(session.difficulty(), 'easy');
    assert.equal(session.holding(), 'deal');
  });

  it('replaces the target word on reroll and keeps the difficulty', () => {
    const { session } = visit();
    session.signIn();
    session.choose('nightmare');

    const word = session.reroll();

    assert.equal(word, 'berry');
    assert.equal(session.shownWord(), 'berry');
    assert.equal(session.difficulty(), 'nightmare');
    assert.equal(session.holding(), 'deal');
  });

  it('starts the round at the first message, not when the word is dealt', () => {
    const { session } = visit({ words: ['banana', 'berry'] });
    session.signIn();
    session.choose('normal');

    assert.equal(session.holding(), 'deal');

    session.takeTurn('hi', 'nope');

    assert.equal(session.holding(), 'round');
    assert.equal(session.reroll(), 'banana');
    assert.equal(session.shownWord(), 'banana');
  });

  it('discards a deal on reset and stays empty until a difficulty is chosen', () => {
    const { session } = visit();
    session.signIn();
    session.choose('hard');

    session.reset();

    assert.equal(session.holding(), 'empty');
    assert.equal(session.shownWord(), null);
    assert.equal(session.difficulty(), null);

    session.choose('easy');
    assert.equal(session.shownWord(), 'berry');
    assert.equal(session.difficulty(), 'easy');
  });

  it('holds one deal or one round, never two and never both', () => {
    const { session } = visit();
    session.signIn();
    session.choose('easy');
    session.choose('hard');

    assert.equal(session.holding(), 'deal');
    assert.equal(session.shownWord(), 'apple');
    assert.equal(session.difficulty(), 'easy');

    session.takeTurn('hi', 'nope');
    session.choose('nightmare');

    assert.equal(session.holding(), 'round');
    assert.equal(session.shownWord(), 'apple');
    assert.equal(session.difficulty(), 'easy');
  });

  it('suspends on sign-out and resumes the deal on the same browser', () => {
    const memory = new InMemorySessionMemory();
    const first = visit({ memory, words: ['apple', 'berry'] });
    first.session.signIn();
    first.session.choose('easy');
    first.session.signOut();
    assert.equal(first.session.shownWord(), null);

    const second = visit({ memory, browserId: 'this-browser', words: ['nope'] });
    assert.equal(second.session.shownWord(), null);
    second.session.signIn();

    assert.equal(second.session.shownWord(), 'apple');
    assert.equal(second.session.difficulty(), 'easy');
    assert.equal(second.session.holding(), 'deal');
  });

  it('resumes a declined round on the same browser', () => {
    const memory = new InMemorySessionMemory();
    const leaderboard = new InMemoryLeaderboard();
    const first = visit({ memory, leaderboard, words: ['banana'] });
    first.session.signIn();
    first.session.choose('normal');
    first.session.takeTurn('hi', 'banana');
    first.session.decline();
    first.session.signOut();

    const second = visit({ memory, leaderboard, words: ['other'] });
    second.session.signIn();

    assert.equal(second.session.holding(), 'round');
    assert.equal(second.session.figure(), 5);
    assert.equal(second.session.canSend(), false);
    assert.equal(second.session.canCommit(), false);
    second.session.commit('Ada');
    assert.equal(leaderboard.entries().length, 0);
  });

  it('does not show the deal on a different browser', () => {
    const memory = new InMemorySessionMemory();
    const here = visit({ memory, browserId: 'here' });
    here.session.signIn();
    here.session.choose('easy');

    const there = visit({ memory, browserId: 'there', words: ['other'] });
    there.session.signIn();

    assert.equal(there.session.holding(), 'empty');
    assert.equal(there.session.shownWord(), null);
  });

  it('cannot resume a round after this browser loses the stored session', () => {
    const memory = new InMemorySessionMemory();
    const first = visit({ memory, words: ['apple'] });
    first.session.signIn();
    first.session.choose('easy');
    first.session.takeTurn('hi', 'nope');
    memory.forget('this-browser');

    const second = visit({ memory, words: ['other'] });
    second.session.signIn();

    assert.equal(second.session.holding(), 'empty');
    assert.equal(second.session.shownWord(), null);
  });

  it('resumes the same session after a passphrase change forces sign-in again', () => {
    const memory = new InMemorySessionMemory();
    const first = visit({ memory, words: ['apple', 'berry'] });
    first.session.signIn();
    first.session.choose('hard');
    first.session.passphraseChanged();

    assert.equal(first.session.signedIn(), false);
    assert.equal(first.session.shownWord(), null);

    const second = visit({ memory, words: ['nope'] });
    second.session.signIn();

    assert.equal(second.session.shownWord(), 'apple');
    assert.equal(second.session.difficulty(), 'hard');
    assert.equal(second.session.holding(), 'deal');
  });

  it('resumes an undecided win on the same browser and keeps a decline', () => {
    const memory = new InMemorySessionMemory();
    const leaderboard = new InMemoryLeaderboard();
    const first = visit({ memory, leaderboard, words: ['banana'] });
    first.session.signIn();
    first.session.choose('normal');
    first.session.takeTurn('hi', 'banana');
    assert.equal(first.session.provisionalPlace(), 1);

    first.session.signOut();
    const resumed = visit({ memory, leaderboard, words: ['other'] });
    resumed.session.signIn();

    assert.equal(resumed.session.provisionalPlace(), 1);
    assert.equal(resumed.session.canCommit(), true);
    assert.equal(resumed.session.canSend(), false);
    resumed.session.commit('Ada');
    assert.equal(leaderboard.entries().length, 1);
    assert.equal(resumed.session.currentRank(), 1);
    assert.equal(resumed.session.provisionalPlace(), null);

    const declined = visit({ memory: new InMemorySessionMemory(), words: ['banana'] });
    declined.session.signIn();
    declined.session.choose('easy');
    declined.session.takeTurn('hi', 'banana');
    declined.session.decline();
    declined.session.signOut();

    const back = visit({
      memory: declined.memory,
      leaderboard: declined.leaderboard,
      words: ['other'],
    });
    back.session.signIn();

    assert.equal(back.session.provisionalPlace(), null);
    assert.equal(back.session.canCommit(), false);
    assert.equal(back.session.canSend(), false);
    assert.equal(back.session.figure(), 5);
    back.session.commit('Bea');
    assert.equal(declined.leaderboard.entries().length, 0);
  });

  it('is empty just after sign-in and just after reset', () => {
    const { session } = visit();
    session.signIn();
    assert.equal(session.holding(), 'empty');

    session.choose('easy');
    session.reset();
    assert.equal(session.holding(), 'empty');
  });
});
