/**
 * llm.helpers.ts — internal helpers for the LLM service.
 *
 * Kept separate so llm.ts stays focused on I/O and these pure utilities can
 * be tested independently without making any network calls.
 */
import { encoding_for_model } from 'tiktoken';
import { TargetWordMatcher } from '../domain/TargetWordMatcher.js';
import { HttpError } from '../http/HttpError.js';
import { buildNormalPrompt } from '../prompts/normalPrompt.js';
import { buildCheatPrompt }  from '../prompts/cheatPrompt.js';
import { buildLossPrompt }   from '../prompts/lossPrompt.js';
import type { ChatCompletionOptions } from './llm.js';

// ─── Token counting ───────────────────────────────────────────────────────────

// cl100k_base (exposed via gpt-4 alias) is compatible with DeepSeek models.
const encoder = encoding_for_model('gpt-4');

/** Count tokens in a string, falling back to a character-ratio estimate. */
export function countTokens(text: string): number {
  try {
    return encoder.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

/** Release the tiktoken WASM encoder — call once on process shutdown. */
export function freeEncoder(): void {
  encoder.free();
}

// ─── Target-word detection ────────────────────────────────────────────────────

/** Case-insensitive whole-word match. */
export function containsTargetWord(text: string, targetWord: string): boolean {
  return new TargetWordMatcher(targetWord).appearsIn(text);
}

// ─── System prompt selection ──────────────────────────────────────────────────

/** Pick and build the correct system prompt from the caller's options. */
export function buildSystemPrompt(options: ChatCompletionOptions): string {
  const {
    targetWord,
    lossMode = false,
    cheatMode = false,
    lossTokenCount = 0,
    lossRank = 1,
    lossTotalEntries = 1,
  } = options;

  if (lossMode)  return buildLossPrompt(targetWord, lossTokenCount, lossRank, lossTotalEntries);
  if (cheatMode) return buildCheatPrompt(targetWord);
  return buildNormalPrompt(targetWord);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

/** Authorization headers, plus any provider-specific extras. */
export function buildAuthHeaders(apiKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...extra,
  };
}

// ─── Error normalisation ──────────────────────────────────────────────────────

type AxiosLike = {
  response?: { status?: number; data?: unknown };
  code?: string;
  message?: string;
};

/**
 * Convert an axios error (or any unknown throw) into a typed Error with a
 * developer-friendly message.
 */
export function normaliseApiError(error: unknown): HttpError {
  const e = error as AxiosLike;
  const status = e.response?.status;

  if (status === 401) return new HttpError(502, 'The model rejected the server API key');
  if (status === 429) return new HttpError(503, 'The model is rate limiting requests — try again shortly');
  if (e.code === 'ECONNABORTED') return new HttpError(504, 'The model took too long to respond');
  return new HttpError(502, 'The model could not complete this turn');
}
