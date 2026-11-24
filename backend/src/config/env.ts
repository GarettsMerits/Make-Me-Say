/**
 * Environment configuration
 *
 * Single source of truth for every env-var the app reads.
 * Validated eagerly at startup — missing required values exit the process
 * immediately rather than failing silently at runtime.
 *
 * Import this module instead of reading process.env directly elsewhere.
 */
import dotenv from 'dotenv';
import { createModelRoster, type ModelRoster } from './models.js';
dotenv.config();

// ─── Exported config ──────────────────────────────────────────────────────────

function presentEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (value.startsWith('sk-your_') || value.startsWith('your_')) return undefined;
  return value;
}

const openRouterKey = presentEnv('OPENROUTER_API_KEY');
const deepseekKey = presentEnv('DEEPSEEK_API_KEY');
const simulateModel = process.env.SIMULATE_MODEL === 'true';
if (!simulateModel && !openRouterKey && !deepseekKey) {
  console.error(
    '\n[startup] Set OPENROUTER_API_KEY or DEEPSEEK_API_KEY in backend/.env.\n' +
    '  A placeholder value does not count.\n',
  );
  process.exit(1);
}

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export const modelRoster: ModelRoster = createModelRoster({
  openRouterKey,
  openRouterUrl: process.env.OPENROUTER_API_URL,
  deepseekKey,
  deepseekUrl: process.env.DEEPSEEK_API_URL,
  referer: frontendUrl,
  overrides: {
    easy: process.env.LLM_MODEL_EASY,
    normal: process.env.LLM_MODEL_NORMAL,
    hard: process.env.LLM_MODEL_HARD,
    nightmare: process.env.LLM_MODEL_NIGHTMARE,
  },
});

const ONE_GIBIBYTE = 1024 * 1024 * 1024;

export const ENV = {
  port:             parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv:          process.env.NODE_ENV ?? 'development',
  frontendUrl,
  /** Bytes at which the oldest conversations start being deleted. Default 1 GiB. */
  dbSizeLimitBytes: parsePositiveInt(process.env.DB_SIZE_LIMIT_BYTES, ONE_GIBIBYTE),
  /**
   * Log the computed passphrase on startup. Off unless explicitly enabled,
   * so a shared console does not print the gate secret by default.
   */
  logPassphrase:    (process.env.LOG_PASSPHRASE ?? 'false').toLowerCase() === 'true',
  enableCheatMode:  process.env.ENABLE_CHEAT_MODE === 'true',
  /**
   * Number of trusted proxy hops for `req.ip`. Unset means the socket address
   * is used, which avoids accepting a spoofed X-Forwarded-For.
   */
  trustProxy:       resolveTrustProxy(process.env.TRUST_PROXY),
} as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveTrustProxy(value: string | undefined): number | false {
  if (!value || value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'true') return 1;
  const hops = Number(value);
  return Number.isInteger(hops) && hops > 0 ? hops : false;
}
