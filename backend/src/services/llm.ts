/**
 * LLM (Large Language Model) service for DeepSeek API integration.
 * Handles chat completions with prompt injection to prevent target word usage.
 */
import axios from 'axios';
import { encoding_for_model } from 'tiktoken';
import { buildNormalPrompt } from '../prompts/normalPrompt.js';
import { buildCheatPrompt } from '../prompts/cheatPrompt.js';
import { buildLossPrompt } from '../prompts/lossPrompt.js';

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// Initialize tiktoken encoder for token counting
// Using cl100k_base which is compatible with most modern models
const encoder = encoding_for_model('gpt-4');

/**
 * Message interface matching OpenAI/DeepSeek format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat completion options
 */
export interface ChatCompletionOptions {
  targetWord: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** When true, uses the cheat prompt that forces the LLM to say the target word. */
  cheatMode?: boolean;
  /** When true, uses the loss prompt that has the LLM acknowledge its defeat. */
  lossMode?: boolean;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  message: string;
  tokenCount: number;
  containsTargetWord: boolean;
}

/**
 * Count tokens in a string using tiktoken
 */
export function countTokens(text: string): number {
  try {
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    console.error('Error counting tokens:', error);
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Escape any regex metacharacters in a plain string so it can be safely
 * embedded inside a RegExp pattern.
 * e.g. "c++" becomes "c\+\+", "what?" becomes "what\?"
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if text contains the target word (case-insensitive, whole word match).
 * Not exported — only used internally within this module.
 */
function containsTargetWord(text: string, targetWord: string): boolean {
  const regex = new RegExp(`\\b${escapeRegExp(targetWord)}\\b`, 'i');
  return regex.test(text);
}

/**
 * Send a chat completion request to DeepSeek API
 */
export async function getChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
  try {
    const { targetWord, messages, maxTokens = 500, temperature = 0.7, cheatMode = false, lossMode = false } = options;
    
    // Select prompt based on mode
    const systemPrompt = lossMode
      ? buildLossPrompt(targetWord)
      : cheatMode
        ? buildCheatPrompt(targetWord)
        : buildNormalPrompt(targetWord);
    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];
    
    // Make API request to DeepSeek
    const response = await axios.post(
      `${DEEPSEEK_API_URL}/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: messagesWithSystem,
        max_tokens: maxTokens,
        temperature: temperature,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    const assistantMessage = response.data.choices[0].message.content;
    const tokenCount = countTokens(assistantMessage);
    const hasTargetWord = containsTargetWord(assistantMessage, targetWord);
    
    return {
      message: assistantMessage,
      tokenCount,
      containsTargetWord: hasTargetWord
    };
    
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; code?: string; message?: string };
    console.error('LLM API error:', axiosError.response?.data ?? (error instanceof Error ? error.message : error));

    if (axiosError.response?.status === 401) {
      throw new Error('Invalid API key. Please check DEEPSEEK_API_KEY in .env file');
    } else if (axiosError.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later');
    } else if (axiosError.code === 'ECONNABORTED') {
      throw new Error('Request timeout. The LLM service is taking too long to respond');
    } else {
      throw new Error(`LLM service error: ${axiosError.message ?? 'unknown error'}`);
    }
  }
}

/**
 * Stream a chat completion from DeepSeek, yielding text delta chunks as they
 * arrive. The caller is responsible for accumulating them into a full response.
 *
 * @yields  Each non-empty text delta string from the stream
 */
export async function* streamChatCompletion(
  options: ChatCompletionOptions
): AsyncGenerator<string> {
  const { targetWord, messages, maxTokens = 500, temperature = 0.7, cheatMode = false, lossMode = false } = options;

  const systemPrompt = lossMode
    ? buildLossPrompt(targetWord)
    : cheatMode
      ? buildCheatPrompt(targetWord)
      : buildNormalPrompt(targetWord);
  const messagesWithSystem: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const response = await axios.post(
    `${DEEPSEEK_API_URL}/chat/completions`,
    {
      model: 'deepseek-chat',
      messages: messagesWithSystem,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      responseType: 'stream',
      timeout: 60000,
    }
  );

  let buffer = '';
  for await (const raw of response.data) {
    buffer += (raw as Buffer).toString('utf8');
    // SSE lines are separated by \n; a single chunk may contain multiple lines
    const lines = buffer.split('\n');
    // Keep any incomplete line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        const delta: string = parsed.choices?.[0]?.delta?.content ?? '';
        if (delta) yield delta;
      } catch {
        // Malformed line — skip
      }
    }
  }
}

/**
 * Cleanup encoder when shutting down
 */
export function cleanup(): void {
  encoder.free();
}
