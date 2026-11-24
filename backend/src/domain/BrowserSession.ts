import type { Difficulty } from '../types.js';
import type { Leaderboard } from './InMemoryLeaderboard.js';
import { Round, type RoundState, type TokenCounter } from './Round.js';

export type Holding = 'empty' | 'deal' | 'round';

export interface WordDeck {
  next(difficulty: Difficulty): string;
}

/** One browser's stored visit. A different id is a different session. */
export interface SessionMemory {
  read(browserId: string): string | null;
  write(browserId: string, value: string | null): void;
}

export class InMemorySessionMemory implements SessionMemory {
  private readonly rows = new Map<string, string>();

  read(browserId: string): string | null {
    return this.rows.get(browserId) ?? null;
  }

  write(browserId: string, value: string | null): void {
    if (value === null) this.rows.delete(browserId);
    else this.rows.set(browserId, value);
  }

  forget(browserId: string): void {
    this.rows.delete(browserId);
  }
}

interface StoredVisit {
  phase: Holding;
  difficulty: Difficulty | null;
  targetWord: string | null;
  round: RoundState | null;
}

const EMPTY: StoredVisit = {
  phase: 'empty',
  difficulty: null,
  targetWord: null,
  round: null,
};

/**
 * One browser's visit. It holds a deal, or an open round, or neither.
 * Sign-out hides it. Sign-in on this browser shows it again.
 */
export class BrowserSession {
  private signed = false;
  private view: StoredVisit = { ...EMPTY };
  private round: Round | null = null;

  constructor(
    private readonly options: {
      browserId: string;
      memory: SessionMemory;
      leaderboard: Leaderboard;
      words: WordDeck;
      tokens: TokenCounter;
    },
  ) {}

  signIn(): void {
    this.signed = true;
    this.view = this.read();
    this.round = this.rebuildRound();
  }

  signOut(): void {
    if (this.signed) this.persist();
    this.signed = false;
    this.view = { ...EMPTY };
    this.round = null;
  }

  /** The monthly passphrase changed. This browser must sign in again. */
  passphraseChanged(): void {
    this.signOut();
  }

  signedIn(): boolean {
    return this.signed;
  }

  choose(difficulty: Difficulty): string | null {
    if (!this.signed || this.view.phase !== 'empty') return this.shownWord();
    this.view = {
      phase: 'deal',
      difficulty,
      targetWord: this.options.words.next(difficulty),
      round: null,
    };
    this.persist();
    return this.view.targetWord;
  }

  reroll(): string | null {
    if (!this.signed || this.view.phase !== 'deal' || !this.view.difficulty) return this.shownWord();
    this.view = {
      ...this.view,
      targetWord: this.options.words.next(this.view.difficulty),
    };
    this.persist();
    return this.view.targetWord;
  }

  holding(): Holding {
    if (!this.signed) return 'empty';
    return this.view.phase;
  }

  shownWord(): string | null {
    if (!this.signed) return null;
    return this.view.targetWord;
  }

  difficulty(): Difficulty | null {
    if (!this.signed) return null;
    return this.view.difficulty;
  }

  takeTurn(playerMessage: string, modelReply: string): void {
    if (!this.signed) return;
    const round = this.ensureRound();
    if (!round) return;
    round.takeTurn(playerMessage, modelReply);
    this.syncRound();
  }

  send(playerMessage: string): void {
    if (!this.signed) return;
    const round = this.ensureRound();
    if (!round) return;
    round.send(playerMessage);
    this.syncRound();
  }

  receiveModelReply(text: string): void {
    if (!this.signed || !this.round) return;
    this.round.receiveModelReply(text);
    this.syncRound();
  }

  commit(name: string): void {
    if (!this.signed || !this.round) return;
    this.round.commit(name);
    this.syncRound();
  }

  decline(): void {
    if (!this.signed || !this.round) return;
    this.round.decline();
    this.syncRound();
  }

  reset(): void {
    if (!this.signed) return;
    if (this.view.phase === 'deal') {
      this.view = { ...EMPTY };
      this.round = null;
      this.persist();
      return;
    }
    if (!this.round) return;
    this.round.reset();
    if (!this.round.isOpen()) {
      this.view = { ...EMPTY };
      this.round = null;
    } else {
      this.syncRound();
      return;
    }
    this.persist();
  }

  figure(): number {
    if (!this.signed || !this.round) return 0;
    return this.round.figure();
  }

  canSend(): boolean {
    if (!this.signed) return false;
    if (this.view.phase === 'deal') return true;
    return this.round?.canSend() ?? false;
  }

  canCommit(): boolean {
    if (!this.signed || !this.round) return false;
    return this.round.canCommit();
  }

  provisionalPlace(): number | null {
    if (!this.signed || !this.round) return null;
    return this.round.provisionalPlace();
  }

  currentRank(): number | null {
    if (!this.signed || !this.round) return null;
    return this.round.currentRank();
  }

  private ensureRound(): Round | null {
    if (this.round) return this.round;
    if (this.view.phase !== 'deal' || !this.view.targetWord || !this.view.difficulty) return null;
    this.round = new Round({
      targetWord: this.view.targetWord,
      difficulty: this.view.difficulty,
      tokens: this.options.tokens,
      leaderboard: this.options.leaderboard,
    });
    this.view = { ...this.view, phase: 'round' };
    this.syncRound();
    return this.round;
  }

  private syncRound(): void {
    if (!this.round || !this.view.difficulty || !this.view.targetWord) return;
    this.view = {
      phase: 'round',
      difficulty: this.view.difficulty,
      targetWord: this.view.targetWord,
      round: this.round.capture(),
    };
    this.persist();
  }

  private rebuildRound(): Round | null {
    if (this.view.phase !== 'round' || !this.view.round || !this.view.targetWord || !this.view.difficulty) {
      return null;
    }
    const round = new Round({
      targetWord: this.view.targetWord,
      difficulty: this.view.difficulty,
      tokens: this.options.tokens,
      leaderboard: this.options.leaderboard,
    });
    round.restore(this.view.round);
    return round;
  }

  private persist(): void {
    this.options.memory.write(this.options.browserId, JSON.stringify(this.view));
  }

  private read(): StoredVisit {
    const raw = this.options.memory.read(this.options.browserId);
    if (!raw) return { ...EMPTY };
    try {
      const parsed = JSON.parse(raw) as StoredVisit;
      if (!parsed || (parsed.phase !== 'empty' && parsed.phase !== 'deal' && parsed.phase !== 'round')) {
        return { ...EMPTY };
      }
      return parsed;
    } catch {
      return { ...EMPTY };
    }
  }
}
