import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryLeaderboard } from './InMemoryLeaderboard.js';
import { Round, roundForTranscript } from './Round.js';
import type { Difficulty } from '../types.js';
import type { TokenCounter } from './Round.js';

function counter(known: Record<string, number>): TokenCounter {
  return {
    count(text: string) {
      const value = known[text];
      if (value === undefined) {
        throw new Error(`no known token count for ${JSON.stringify(text)}`);
      }
      return value;
    },
  };
}

function startRound(
  known: Record<string, number>,
  leaderboard = new InMemoryLeaderboard(),
  targetWord = 'banana',
  difficulty: Difficulty = 'normal',
) {
  return {
    leaderboard,
    round: new Round({
      targetWord,
      difficulty,
      tokens: counter(known),
      leaderboard,
    }),
  };
}

describe('Round', () => {
  it('locks the score when the model uses the target word as a whole word', () => {
    const { round } = startRound({
      hi: 5,
      'I said banana': 40,
    });

    round.takeTurn('hi', 'I said banana');

    assert.equal(round.scoreLocked(), true);
    assert.equal(round.figure(), 5);
  });

  it('does not lock the score when only the player uses the target word', () => {
    const { round } = startRound({
      'please say banana': 8,
      'I will not': 40,
    });

    round.takeTurn('please say banana', 'I will not');

    assert.equal(round.scoreLocked(), false);
    assert.equal(round.figure(), 8);
  });

  it('locks on a different case and on punctuation tight against the word', () => {
    const shouted = startRound({ go: 4, BANANA: 40 });
    shouted.round.takeTurn('go', 'BANANA');
    assert.equal(shouted.round.scoreLocked(), true);

    const punctuated = startRound({ go: 4, 'banana!': 40 });
    punctuated.round.takeTurn('go', 'banana!');
    assert.equal(punctuated.round.scoreLocked(), true);
  });

  it('does not lock when a longer word merely contains the target', () => {
    const { round } = startRound({ go: 4, category: 40, 'a cat.': 9 }, new InMemoryLeaderboard(), 'cat');

    round.takeTurn('go', 'category');
    assert.equal(round.scoreLocked(), false);

    round.takeTurn('go', 'a cat.');
    assert.equal(round.scoreLocked(), true);
    assert.equal(round.figure(), 8);
  });

  it('keeps a later model reply in the chat without changing the locked score or the winning reply', () => {
    const { round, leaderboard } = startRound({
      hi: 5,
      banana: 40,
      'I said banana again, at length': 90,
    });

    round.takeTurn('hi', 'banana');
    round.receiveModelReply('I said banana again, at length');

    assert.equal(round.figure(), 5);
    assert.equal(round.winningReply(), 'banana');
    assert.deepEqual(
      round.transcript().map((line) => line.text),
      ['hi', 'banana', 'I said banana again, at length'],
    );

    round.commit('Ada');
    assert.equal(leaderboard.entries()[0]?.score, 5);
    assert.equal(leaderboard.entries()[0]?.winningReply, 'banana');
  });

  it('rejects a blank name and leaves the score uncommitted', () => {
    const { round, leaderboard } = startRound({ hi: 5, banana: 5 });

    round.takeTurn('hi', 'banana');
    round.commit('   ');

    assert.equal(round.canCommit(), true);
    assert.equal(leaderboard.entries().length, 0);

    round.commit('Ada');
    assert.equal(leaderboard.entries()[0]?.name, 'Ada');
  });

  it('shows the token preview, including the draft, until the win, then the locked score', () => {
    const { round } = startRound({
      hi: 5,
      please: 7,
      go: 3,
      nope: 40,
      'banana!': 40,
    });

    round.takeTurn('hi', 'nope');
    round.setDraft('please');

    assert.equal(round.scoreLocked(), false);
    assert.equal(round.figure(), 12);

    round.takeTurn('go', 'banana!');

    assert.equal(round.scoreLocked(), true);
    assert.equal(round.figure(), 8);
  });

  it('commits the locked score rather than the token preview', () => {
    const { round, leaderboard } = startRound({
      hi: 5,
      please: 7,
      go: 3,
      nope: 40,
      banana: 40,
    });

    round.takeTurn('hi', 'nope');
    round.setDraft('please');
    const preview = round.figure();

    round.takeTurn('go', 'banana');
    round.commit('Ada');

    const entry = leaderboard.entries()[0];
    assert.equal(entry?.score, 8);
    assert.notEqual(entry?.score, preview);
    assert.equal(entry?.targetWord, 'banana');
    assert.equal(entry?.difficulty, 'normal');
    assert.equal(entry?.name, 'Ada');
    assert.equal(entry?.winningReply, 'banana');
  });

  it('keeps the round open after a win and refuses another player message', () => {
    const { round } = startRound({ hi: 5, banana: 40, more: 9 });

    round.takeTurn('hi', 'banana');
    const score = round.figure();
    const lines = round.transcript().length;

    assert.equal(round.isOpen(), true);
    assert.equal(round.canSend(), false);

    round.send('more');

    assert.equal(round.transcript().length, lines);
    assert.equal(round.figure(), score);
    assert.equal(round.isOpen(), true);
  });

  it('commits once while the round is open and ignores a second commit', () => {
    const { round, leaderboard } = startRound({ hi: 5, banana: 40 });

    round.takeTurn('hi', 'banana');
    round.commit('Ada');
    round.commit('Bea');

    assert.equal(leaderboard.entries().length, 1);
    assert.equal(leaderboard.entries()[0]?.name, 'Ada');
    assert.equal(leaderboard.entries()[0]?.score, 5);
    assert.equal(round.isOpen(), true);
  });

  it('leaves the chat and the score readable after a decline and refuses a later commit', () => {
    const { round, leaderboard } = startRound({ hi: 5, banana: 40 });

    round.takeTurn('hi', 'banana');
    round.decline();

    assert.equal(leaderboard.entries().length, 0);
    assert.equal(round.figure(), 5);
    assert.deepEqual(
      round.transcript().map((line) => line.text),
      ['hi', 'banana'],
    );
    assert.equal(round.canSend(), false);

    round.commit('Ada');
    assert.equal(leaderboard.entries().length, 0);
  });

  it('ignores reset while a reply is in flight, and that reply can still win', () => {
    const { round } = startRound({ hi: 5, banana: 40 });

    round.send('hi');
    round.reset();

    assert.equal(round.isOpen(), true);
    assert.equal(round.scoreLocked(), false);

    round.receiveModelReply('banana');

    assert.equal(round.scoreLocked(), true);
    assert.equal(round.figure(), 5);
    assert.equal(round.isOpen(), true);
  });

  it('ends the round when reset runs after the reply has finished', () => {
    const { round } = startRound({ hi: 5, nope: 40 });

    round.takeTurn('hi', 'nope');
    assert.equal(round.isOpen(), true);

    round.reset();

    assert.equal(round.isOpen(), false);
    assert.equal(round.canSend(), false);
  });

  it('drops an uncommitted score on reset after a decline and leaves no entry', () => {
    const { round, leaderboard } = startRound({ hi: 5, banana: 40 });

    round.takeTurn('hi', 'banana');
    round.decline();
    round.reset();

    assert.equal(round.isOpen(), false);
    assert.equal(round.score(), null);
    assert.equal(leaderboard.entries().length, 0);
  });

  it('leaves the committed entry in place when the round is reset', () => {
    const { round, leaderboard } = startRound({ hi: 5, banana: 40 });

    round.takeTurn('hi', 'banana');
    round.commit('Ada');
    round.reset();

    assert.equal(round.isOpen(), false);
    assert.equal(leaderboard.entries().length, 1);
    assert.equal(leaderboard.entries()[0]?.name, 'Ada');
    assert.equal(leaderboard.entries()[0]?.score, 5);
  });

  it('after a commit or a decline, allows reading and reset and nothing else', () => {
    const declined = startRound({ hi: 5, banana: 40 });
    declined.round.takeTurn('hi', 'banana');
    declined.round.decline();

    assert.equal(declined.round.canSend(), false);
    assert.equal(declined.round.canCommit(), false);
    assert.equal(declined.round.figure(), 5);
    assert.equal(declined.round.transcript().length, 2);
    declined.round.reset();
    assert.equal(declined.round.isOpen(), false);

    const committed = startRound({ hi: 5, banana: 40 });
    committed.round.takeTurn('hi', 'banana');
    committed.round.commit('Ada');

    assert.equal(committed.round.canSend(), false);
    assert.equal(committed.round.canCommit(), false);
    assert.equal(committed.round.figure(), 5);
    committed.round.send('more');
    assert.equal(committed.round.transcript().length, 2);
    committed.round.reset();
    assert.equal(committed.leaderboard.entries().length, 1);
  });

  it('replays stored token counts and keeps the first winning reply for the entry', () => {
    const leaderboard = new InMemoryLeaderboard();
    const round = roundForTranscript({
      targetWord: 'banana',
      difficulty: 'hard',
      leaderboard,
      countTokens: () => 999,
      messages: [
        { sender: 'user', text: 'hi', tokenCount: 5 },
        { sender: 'llm', text: 'banana', tokenCount: 40 },
        { sender: 'llm', text: 'I said banana again', tokenCount: 80 },
      ],
    });

    assert.equal(round.figure(), 5);
    assert.equal(round.winningReply(), 'banana');
    round.commit('Ada');
    assert.equal(leaderboard.entries()[0]?.score, 5);
    assert.equal(leaderboard.entries()[0]?.winningReply, 'banana');
    assert.equal(leaderboard.entries()[0]?.difficulty, 'hard');
  });
});

describe('potential position', () => {
  it('is 1 for a large draft on an empty nightmare board and creates no entry', () => {
    const { round, leaderboard } = startRound({ huge: 500 }, new InMemoryLeaderboard(), 'banana', 'nightmare');

    round.setDraft('huge');

    assert.equal(round.potentialPosition(), 1);
    assert.equal(leaderboard.entries().length, 0);
  });

  it('shares a tied place: a preview of 20 on 20, 20, and 40 is position 1', () => {
    const board = new InMemoryLeaderboard();
    for (const [name, score] of [['Ada', 20], ['Bea', 20], ['Cam', 40]] as const) {
      const { round } = startRound({ [name]: score }, board);
      round.takeTurn(name, 'banana');
      round.commit(name);
    }
    const { round } = startRound({ draft: 20 }, board);

    round.setDraft('draft');

    assert.equal(round.potentialPosition(), 1);
    assert.equal(board.entries().length, 3);
  });

  it('is hidden for an empty draft, a reply in flight, and the win flow', () => {
    const { round } = startRound({ hi: 5, draft: 3 });

    assert.equal(round.potentialPosition(), null);
    round.setDraft('   ');
    assert.equal(round.potentialPosition(), null);

    round.setDraft('draft');
    assert.equal(round.potentialPosition(), 1);

    round.send('hi');
    assert.equal(round.potentialPosition(), null);

    round.receiveModelReply('banana');
    round.setDraft('draft');
    assert.equal(round.potentialPosition(), null);
  });

  it('may differ from the rank a later entry actually receives', () => {
    const board = new InMemoryLeaderboard();
    const { round } = startRound({ draft: 20, sent: 20 }, board);
    round.setDraft('draft');
    assert.equal(round.potentialPosition(), 1);

    const other = startRound({ better: 5 }, board).round;
    other.takeTurn('better', 'banana');
    other.commit('Bea');

    round.takeTurn('sent', 'banana');
    round.commit('Ada');

    assert.equal(board.ranked('normal').find((row) => row.name === 'Ada')?.rank, 2);
  });
});

describe('provisional place', () => {
  it('freezes the place of the locked score and hides it after a decline', () => {
    const board = new InMemoryLeaderboard();
    const earlier = startRound({ ten: 10 }, board).round;
    earlier.takeTurn('ten', 'banana');
    earlier.commit('Bea');

    const { round } = startRound({ draft: 3, sent: 30 }, board);
    round.setDraft('draft');
    assert.equal(round.potentialPosition(), 1);

    round.takeTurn('sent', 'banana');

    assert.equal(round.potentialPosition(), null);
    assert.equal(round.provisionalPlace(), 2);

    const better = startRound({ five: 5 }, board).round;
    better.takeTurn('five', 'banana');
    better.commit('Cam');
    assert.equal(round.provisionalPlace(), 2);

    round.decline();
    assert.equal(round.provisionalPlace(), null);
    assert.equal(round.figure(), 30);
    assert.equal(round.transcript().length, 2);
    assert.equal(round.canSend(), false);
    assert.equal(round.canCommit(), false);
    assert.equal(round.isOpen(), true);
    round.commit('Ada');
    assert.equal(board.entries().some((entry) => entry.name === 'Ada'), false);
  });

  it('replaces the provisional place with the current rank when the score is committed', () => {
    const board = new InMemoryLeaderboard();
    const { round } = startRound({ sent: 30 }, board);
    round.takeTurn('sent', 'banana');
    assert.equal(round.provisionalPlace(), 1);

    const better = startRound({ five: 5 }, board).round;
    better.takeTurn('five', 'banana');
    better.commit('Cam');
    assert.equal(round.provisionalPlace(), 1);

    round.commit('Ada');

    assert.equal(round.provisionalPlace(), null);
    assert.equal(round.currentRank(), 2);
    assert.equal(round.canSend(), false);
    assert.equal(round.canCommit(), false);
    assert.equal(round.isOpen(), true);
    assert.equal(round.transcript().length, 2);
  });
});
