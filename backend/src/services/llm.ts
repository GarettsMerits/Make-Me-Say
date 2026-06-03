/**
 * LLM service — public API.
 *
 * Thin entry point that wires together config, helpers, and the DeepSeek HTTP
 * client.  All cross-cutting utilities live in llm.helpers.ts; connection
 * parameters live in config/llm.ts.
 */
import axios from 'axios';
import { LLM_CONFIG } from '../config/llm.js';
import {
  buildSystemPrompt,
  buildAuthHeaders,
  normaliseApiError,
  countTokens,
  containsTargetWord,
  freeEncoder,
} from './llm.helpers.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  targetWord: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Uses the cheat prompt — forces the LLM to say the target word. */
  cheatMode?: boolean;
  /** Uses the loss prompt — LLM acknowledges its defeat. */
  lossMode?: boolean;
  /** Total tokens the player used (required when lossMode is true). */
  lossTokenCount?: number;
  /** Rank the player achieved (required when lossMode is true). */
  lossRank?: number;
  /** Total leaderboard entries at time of win (required when lossMode is true). */
  lossTotalEntries?: number;
}

export interface ChatCompletionResponse {
  message: string;
  tokenCount: number;
  containsTargetWord: boolean;
}

// Re-export utilities callers already depend on
export { countTokens, containsTargetWord, freeEncoder as cleanup };

// ─── Streaming completion ─────────────────────────────────────────────────────

/**
 * Stream a chat completion from DeepSeek, yielding text delta chunks as they
 * arrive.  The caller is responsible for accumulating them into a full response.
 *
 * @yields Each non-empty text delta string from the stream.
 */
export async function* streamChatCompletion(
  options: ChatCompletionOptions,
): AsyncGenerator<string> {
  const {
    messages,
    maxTokens   = LLM_CONFIG.defaults.maxTokens,
    temperature = LLM_CONFIG.defaults.temperature,
  } = options;

  const systemPrompt = buildSystemPrompt(options);
  const messagesWithSystem: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  let response;
  try {
    response = await axios.post(
      `${LLM_CONFIG.apiUrl}/chat/completions`,
      {
        model:      LLM_CONFIG.model,
        messages:   messagesWithSystem,
        max_tokens: maxTokens,
        temperature,
        stream:     true,
      },
      {
        headers:      buildAuthHeaders(LLM_CONFIG.apiKey),
        responseType: 'stream',
        timeout:      LLM_CONFIG.timeouts.streaming,
      },
    );
  } catch (error) {
    throw normaliseApiError(error);
  }

  let buffer = '';
  for await (const raw of response.data) {
    buffer += (raw as Buffer).toString('utf8');
    // A single chunk may contain multiple SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep any incomplete trailing line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const delta: string = JSON.parse(payload).choices?.[0]?.delta?.content ?? '';
        if (delta) yield delta;
      } catch {
        // Malformed SSE line — skip silently
      }
    }
  }
}
