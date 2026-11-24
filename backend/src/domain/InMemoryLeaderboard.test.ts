import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryLeaderboard } from './InMemoryLeaderboard.js';
import { Round } from './Round.js';
import type { Difficulty } from '../types.js';

function play(board: InMemoryLeaderboard, difficulty: Difficulty, scoreText: string, name: string): void {
  const round = new Round({
    targetWord: 'banana',
    difficulty,
    leaderboard: board,
    tokens: { count: (text) => (text === scoreText ? Number(scoreText) : 0) },
  });
  round.takeTurn(scoreText, 'banana');
  round.commit(name);
}

describe('a difficulty leaderboard', () => {
  it('lists an entry only on the round difficulty and starts an empty board at rank 1', () => {
    const board = new InMemoryLeaderboard();
    assert.equal(board.place(50, 'nightmare'), 1);
    assert.deepEqual(board.ranked('nightmare'), []);

    play(board, 'easy', '20', 'Ada');
    play(board, 'normal', '5', 'Bea');

    assert.equal(board.ranked('easy').length, 1);
    assert.equal(board.ranked('easy')[0]?.name, 'Ada');
    assert.equal(board.ranked('normal')[0]?.name, 'Bea');
    assert.equal(board.ranked('hard').length, 0);
    assert.equal(board.ranked('nightmare').length, 0);
  });

  it('shares a rank for equal scores and lists the earlier commit first', () => {
    const board = new InMemoryLeaderboard();
    play(board, 'normal', '20', 'Ada');
    play(board, 'normal', '20', 'Bea');
    play(board, 'normal', '40', 'Cam');

    const rows = board.ranked('normal');
    assert.deepEqual(rows.map((row) => row.name), ['Ada', 'Bea', 'Cam']);
    assert.deepEqual(rows.map((row) => row.rank), [1, 1, 3]);
  });

  it('pushes worse entries down by one when a strictly better score arrives', () => {
    const board = new InMemoryLeaderboard();
    play(board, 'hard', '40', 'Ada');
    assert.equal(board.ranked('hard')[0]?.rank, 1);

    play(board, 'hard', '20', 'Bea');

    const rows = board.ranked('hard');
    assert.equal(rows[0]?.name, 'Bea');
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[1]?.name, 'Ada');
    assert.equal(rows[1]?.rank, 2);
    assert.equal(rows[1]?.score, 40);
    assert.equal(rows[1]?.winningReply, 'banana');
  });

  it('does not push anyone when a later score is equal', () => {
    const board = new InMemoryLeaderboard();
    play(board, 'normal', '20', 'Ada');
    const before = board.ranked('normal')[0]?.rank;

    play(board, 'normal', '20', 'Bea');

    const rows = board.ranked('normal');
    assert.equal(before, 1);
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[1]?.rank, 1);
  });

  it('shows the current rank after a later better score without changing stored facts', () => {
    const board = new InMemoryLeaderboard();
    play(board, 'easy', '40', 'Ada');
    const stored = board.entries()[0];

    play(board, 'easy', '10', 'Bea');

    assert.equal(board.ranked('easy').find((row) => row.name === 'Ada')?.rank, 2);
    assert.equal(stored?.name, 'Ada');
    assert.equal(stored?.score, 40);
    assert.equal(stored?.targetWord, 'banana');
    assert.equal(stored?.difficulty, 'easy');
    assert.equal(stored?.winningReply, 'banana');
  });
});
