import { TargetWordMatcher } from './TargetWordMatcher.js';
import type { Leaderboard } from './InMemoryLeaderboard.js';
import type { Difficulty } from '../types.js';

export interface TranscriptMessage {
  sender: 'user' | 'llm';
  text: string;
  tokenCount?: number;
}

export interface TokenCounter {
  count(text: string): number;
}

export interface TranscriptLine {
  speaker: 'player' | 'model';
  text: string;
}

/** Enough of a round to resume it on the same browser. */
export interface RoundState {
  lines: TranscriptLine[];
  playerTokens: number;
  lockedScore: number | null;
  winningReply: string | null;
  draft: string;
  replying: boolean;
  ended: boolean;
  declined: boolean;
  committed: boolean;
  provisional: number | null;
}

/**
 * One match. Callers hand in a player message and a scripted model reply.
 * The token counter and the leaderboard are supplied, so a test never
 * calls a model vendor or a database.
 */
export class Round {
  private readonly matcher: TargetWordMatcher;
  private readonly lines: TranscriptLine[] = [];
  private playerTokens = 0;
  private lockedScore: number | null = null;
  private winningReplyText: string | null = null;
  private draft = '';
  private replying = false;
  private ended = false;
  private declined = false;
  private committed = false;
  private provisional: number | null = null;

  constructor(
    private readonly options: {
      targetWord: string;
      difficulty: Difficulty;
      tokens: TokenCounter;
      leaderboard: Leaderboard;
    },
  ) {
    this.matcher = new TargetWordMatcher(options.targetWord);
  }

  /** Player message together with the model's reply for that turn. */
  takeTurn(playerMessage: string, modelReply: string): void {
    if (!this.canSend()) return;
    this.send(playerMessage);
    this.receiveModelReply(modelReply);
  }

  /**
   * The player message is in. The model's reply has not arrived.
   * Reset does nothing until that reply finishes, and the reply can still win.
   */
  send(playerMessage: string): void {
    if (!this.canSend()) return;
    this.lines.push({ speaker: 'player', text: playerMessage });
    this.playerTokens += this.options.tokens.count(playerMessage);
    this.replying = true;
    this.draft = '';
  }

  /**
   * A model reply. It stays in the chat. Only the first reply that uses
   * the target word locks the score.
   */
  receiveModelReply(text: string): void {
    this.lines.push({ speaker: 'model', text });
    this.replying = false;
    if (this.lockedScore !== null || this.ended) return;
    if (!this.matcher.appearsIn(text)) return;
    this.lockedScore = this.playerTokens;
    this.winningReplyText = text;
    this.provisional = this.options.leaderboard.place(this.lockedScore, this.options.difficulty);
  }

  /** True until reset. A win does not end the round. */
  isOpen(): boolean {
    return !this.ended;
  }

  /** A message can be sent only before the win, and not while a reply is in flight. */
  canSend(): boolean {
    return !this.ended && !this.replying && this.lockedScore === null;
  }

  /** A score can be entered once, after the win and before decline, commit, or reset. */
  canCommit(): boolean {
    return this.isOpen()
      && !this.replying
      && !this.declined
      && !this.committed
      && this.lockedScore !== null
      && this.winningReplyText !== null;
  }

  /** The locked score while it is still on the round. Reset after a decline drops it. */
  score(): number | null {
    return this.lockedScore;
  }

  /**
   * Ends the round after the reply has finished. Ignored while a reply is
   * in flight. An uncommitted score is dropped. A committed entry stays.
   */
  reset(): void {
    if (this.replying) return;
    this.ended = true;
    if (!this.committed) this.lockedScore = null;
  }

  /** Final choice not to commit. The round stays open and readable. */
  decline(): void {
    if (!this.canCommit()) return;
    this.declined = true;
  }

  /** Unsent draft. Included in the token preview, never in the locked score. */
  setDraft(text: string): void {
    this.draft = text;
  }

  /**
   * The place the token preview, including the draft, would take on this
   * difficulty if the draft won. Hidden unless a non-empty draft can still
   * be sent. Reading it does not change the board.
   */
  potentialPosition(): number | null {
    if (!this.canSend() || !this.draft.trim()) return null;
    return this.options.leaderboard.place(this.figure(), this.options.difficulty);
  }

  /**
   * The place the locked score would have taken when the win flow opened.
   * Hidden after a decline or a commit. It does not move while the player waits.
   */
  provisionalPlace(): number | null {
    if (this.declined || this.committed || this.ended || this.lockedScore === null) return null;
    return this.provisional;
  }

  /** The entry's current rank after a commit. */
  currentRank(): number | null {
    if (!this.committed || this.lockedScore === null) return null;
    return this.options.leaderboard.place(this.lockedScore, this.options.difficulty);
  }

  scoreLocked(): boolean {
    return this.lockedScore !== null;
  }

  /**
   * The figure the screen shows: the token preview while a message can
   * still be sent, and the locked score from the win onward.
   */
  figure(): number {
    if (this.lockedScore !== null) return this.lockedScore;
    if (this.ended) return 0;
    return this.playerTokens + this.draftTokens();
  }

  winningReply(): string | null {
    return this.winningReplyText;
  }

  transcript(): readonly TranscriptLine[] {
    return this.lines;
  }

  /** Store the locked score once. A blank name and a second commit do nothing. */
  commit(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!this.canCommit() || this.lockedScore === null || this.winningReplyText === null) return;
    this.committed = true;
    this.options.leaderboard.commit({
      name: trimmed,
      score: this.lockedScore,
      targetWord: this.options.targetWord,
      difficulty: this.options.difficulty,
      winningReply: this.winningReplyText,
    });
  }

  capture(): RoundState {
    return {
      lines: this.lines.map((line) => ({ ...line })),
      playerTokens: this.playerTokens,
      lockedScore: this.lockedScore,
      winningReply: this.winningReplyText,
      draft: this.draft,
      replying: this.replying,
      ended: this.ended,
      declined: this.declined,
      committed: this.committed,
      provisional: this.provisional,
    };
  }

  restore(state: RoundState): void {
    this.lines.splice(0, this.lines.length, ...state.lines.map((line) => ({ ...line })));
    this.playerTokens = state.playerTokens;
    this.lockedScore = state.lockedScore;
    this.winningReplyText = state.winningReply;
    this.draft = state.draft;
    this.replying = state.replying;
    this.ended = state.ended;
    this.declined = state.declined;
    this.committed = state.committed;
    this.provisional = state.provisional;
  }

  private draftTokens(): number {
    const text = this.draft.trim();
    if (!text) return 0;
    return this.options.tokens.count(text);
  }
}

/**
 * Drive a round from a stored transcript. Player token counts already on
 * the messages are the counts that lock; missing ones use `countTokens`.
 */
export function roundForTranscript(input: {
  targetWord: string;
  difficulty: Difficulty;
  messages: readonly TranscriptMessage[];
  leaderboard: Leaderboard;
  countTokens: (text: string) => number;
}): Round {
  const counts: number[] = [];
  for (const message of input.messages) {
    if (message.sender !== 'user') continue;
    const stored = message.tokenCount;
    counts.push(typeof stored === 'number' && Number.isFinite(stored) ? stored : input.countTokens(message.text));
  }

  let cursor = 0;
  const round = new Round({
    targetWord: input.targetWord,
    difficulty: input.difficulty,
    leaderboard: input.leaderboard,
    tokens: { count: () => counts[cursor++] ?? 0 },
  });

  let index = 0;
  while (index < input.messages.length) {
    const message = input.messages[index];
    if (!message) break;
    if (message.sender === 'llm') {
      round.receiveModelReply(message.text);
      index += 1;
      continue;
    }
    const reply = input.messages[index + 1];
    if (reply && reply.sender === 'llm') {
      round.takeTurn(message.text, reply.text);
      index += 2;
      continue;
    }
    round.takeTurn(message.text, '');
    index += 1;
  }

  return round;
}
