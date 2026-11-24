/**
 * Answers about a round that already lives in stored messages.
 * A live Round still plays a turn. This one only reads.
 * Place is not answered here.
 */
import type { Difficulty } from '../types.js';
import type { Leaderboard } from './InMemoryLeaderboard.js';
import { roundForTranscript, type TranscriptMessage } from './Round.js';
import { TargetWordMatcher } from './TargetWordMatcher.js';

export interface StoredRoundAnswers {
  /** The model's own reply has already used the target word. */
  locked: boolean;
  /**
   * The last message is the reply that locked the score.
   * An earlier reply with the same text does not count.
   */
  thisReplyWon: boolean;
  /** A name can still be committed. Decline, an earlier commit, and reset all refuse. */
  canCommit: boolean;
  /** The locked score, or null while the player can still send. */
  score: number | null;
  winningReply: string | null;
  /**
   * Tokens in the player's messages. This is the score once locked,
   * and the running total before that.
   */
  figure: number;
}

const unusedBoard: Leaderboard = {
  place: () => 1,
  commit() {},
};

/**
 * Read a stored transcript. `declined`, `scoreSubmitted`, and `ended`
 * are the row flags. They do not change the score or the winning reply.
 */
export function readStoredRound(input: {
  targetWord: string;
  difficulty: Difficulty;
  messages: readonly TranscriptMessage[];
  countTokens: (text: string) => number;
  declined?: boolean;
  scoreSubmitted?: boolean;
  ended?: boolean;
}): StoredRoundAnswers {
  const round = roundForTranscript({
    targetWord: input.targetWord,
    difficulty: input.difficulty,
    messages: input.messages,
    countTokens: input.countTokens,
    leaderboard: unusedBoard,
  });
  const locked = round.scoreLocked();
  const winningReply = round.winningReply();
  const score = locked ? round.score() : null;
  const refused = Boolean(input.declined) || Boolean(input.scoreSubmitted) || Boolean(input.ended);

  return {
    locked,
    thisReplyWon: locked && wonOnLastMessage(input.messages, input.targetWord),
    canCommit: locked && winningReply !== null && !refused,
    score,
    winningReply,
    figure: round.figure(),
  };
}

/** The first model reply that says the word is the one that locked the score. */
function wonOnLastMessage(messages: readonly TranscriptMessage[], targetWord: string): boolean {
  const matcher = new TargetWordMatcher(targetWord);
  let winningIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message || message.sender !== 'llm') continue;
    if (!matcher.appearsIn(message.text)) continue;
    winningIndex = index;
    break;
  }
  return winningIndex >= 0 && winningIndex === messages.length - 1;
}
