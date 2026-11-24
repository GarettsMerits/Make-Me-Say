import { TargetWordMatcher } from './TargetWordMatcher.js';

export interface ScoredMessage {
  sender: 'user' | 'llm';
  text: string;
  tokenCount?: number;
}

/**
 * The score for a finished session: the player's own recorded token counts,
 * and the first model reply that actually contains the target word.
 */
export class PlayerScore {
  constructor(private readonly messages: readonly ScoredMessage[]) {}

  get tokenCount(): number {
    return this.messages.reduce((sum, message) => {
      if (message.sender !== 'user') return sum;
      return sum + (message.tokenCount ?? 0);
    }, 0);
  }

  victoryMessage(targetWord: string): string | null {
    const matcher = new TargetWordMatcher(targetWord);
    const winning = this.messages.find(
      (message) => message.sender === 'llm' && matcher.appearsIn(message.text),
    );
    return winning?.text ?? null;
  }
}

/** mysql2 may already have parsed a JSON column. */
export function parseStoredMessages(raw: unknown): ScoredMessage[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw || '[]');
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const messages: ScoredMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const sender = (item as { sender?: unknown }).sender;
    const text = (item as { text?: unknown }).text;
    const tokenCount = (item as { tokenCount?: unknown }).tokenCount;
    if ((sender !== 'user' && sender !== 'llm') || typeof text !== 'string') continue;
    const parsed: ScoredMessage = { sender, text };
    if (typeof tokenCount === 'number' && Number.isFinite(tokenCount)) {
      parsed.tokenCount = tokenCount;
    }
    messages.push(parsed);
  }
  return messages;
}
