/**
 * Which chat model answers each difficulty.
 *
 * OpenRouter slugs are the defaults when OPENROUTER_API_KEY is set.
 * A direct DeepSeek key, with no OpenRouter key, keeps one model name
 * that DeepSeek's own API understands. Either way, LLM_MODEL_* replaces
 * the default for that difficulty.
 */
import type { Difficulty } from '../types.js';

export type LlmProvider = 'openrouter' | 'deepseek';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

/** Cheap conversational models. Stronger instruction-following is a harder game. */
export const OPENROUTER_MODELS: Record<Difficulty, string> = {
  easy: 'deepseek/deepseek-chat-v3.1',
  normal: 'google/gemini-2.5-flash-lite',
  hard: 'qwen/qwen3.6-flash',
  nightmare: 'deepseek/deepseek-v4.1-flash-1017',
};

const DIRECT_DEEPSEEK_MODEL = 'deepseek-chat';

export interface LlmCall {
  baseUrl: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
  /** Extra JSON fields. OpenRouter is asked not to spend a hidden reasoning pass. */
  bodyExtras: Record<string, unknown>;
}

export class ModelRoster {
  constructor(
    private readonly provider: LlmProvider,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly models: Record<Difficulty, string>,
    private readonly referer: string,
  ) {}

  get name(): LlmProvider {
    return this.provider;
  }

  modelFor(difficulty: Difficulty): string {
    return this.models[difficulty];
  }

  callFor(difficulty: Difficulty): LlmCall {
    const headers: Record<string, string> = {};
    let bodyExtras: Record<string, unknown> = {};
    if (this.provider === 'openrouter') {
      headers['HTTP-Referer'] = this.referer;
      headers['X-Title'] = "Don't Make Me Say";
      bodyExtras = { reasoning: { enabled: false } };
    }
    return {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.modelFor(difficulty),
      headers,
      bodyExtras,
    };
  }

  describe(): string {
    return DIFFICULTIES.map((difficulty) => `  ${difficulty}: ${this.models[difficulty]}`).join('\n');
  }
}

export function createModelRoster(input: {
  openRouterKey?: string | undefined;
  openRouterUrl?: string | undefined;
  deepseekKey?: string | undefined;
  deepseekUrl?: string | undefined;
  referer: string;
  overrides?: Partial<Record<Difficulty, string | undefined>>;
}): ModelRoster {
  const useOpenRouter = Boolean(input.openRouterKey);
  const provider: LlmProvider = useOpenRouter ? 'openrouter' : 'deepseek';
  const defaults: Record<Difficulty, string> = useOpenRouter
    ? OPENROUTER_MODELS
    : {
        easy: DIRECT_DEEPSEEK_MODEL,
        normal: DIRECT_DEEPSEEK_MODEL,
        hard: DIRECT_DEEPSEEK_MODEL,
        nightmare: DIRECT_DEEPSEEK_MODEL,
      };
  const models = { ...defaults };
  for (const difficulty of DIFFICULTIES) {
    const override = input.overrides?.[difficulty]?.trim();
    if (override) models[difficulty] = override;
  }
  return new ModelRoster(
    provider,
    useOpenRouter
      ? (input.openRouterUrl?.trim() || 'https://openrouter.ai/api/v1')
      : (input.deepseekUrl?.trim() || 'https://api.deepseek.com/v1'),
    (useOpenRouter ? input.openRouterKey : input.deepseekKey) ?? '',
    models,
    input.referer,
  );
}
