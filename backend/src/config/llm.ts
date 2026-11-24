/**
 * Generation defaults. Which model and which host answer a turn live in
 * config/models.ts and are chosen from the environment.
 */

export const LLM_CONFIG = {
  defaults: {
    maxTokens:   500,
    temperature: 0.85,
  },
  timeouts: {
    standard: 30_000,
    streaming: 60_000,
  },
} as const;
