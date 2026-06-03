/**
 * config/llm.ts — DeepSeek API connection parameters.
 *
 * All LLM connection settings live here so switching models or endpoints
 * requires touching exactly one file.
 *
 * Environment variables (set in backend/.env):
 *   DEEPSEEK_API_URL  — base URL (defaults to the public v1 endpoint)
 *   DEEPSEEK_API_KEY  — secret API key (required in production)
 */

export const LLM_CONFIG = {
  apiUrl:  process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/v1',
  apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
  /** Model identifier sent with every request. Change here to upgrade. */
  model:   'deepseek-chat',
  /** Default generation limits used when callers don't specify their own. */
  defaults: {
    maxTokens:   500,
    temperature: 0.85,
  },
  /** Axios timeouts in milliseconds. */
  timeouts: {
    standard: 30_000,
    streaming: 60_000,
  },
} as const;
