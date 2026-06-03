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
dotenv.config();

// ─── Validation ───────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n[startup] Required environment variable "${name}" is missing.\n`);
    process.exit(1);
  }
  return value;
}

// ─── Exported config ──────────────────────────────────────────────────────────

const deepseekKey = requireEnv('DEEPSEEK_API_KEY');
if (deepseekKey.startsWith('sk-your_')) {
  console.error(
    '\n[startup] DEEPSEEK_API_KEY is still a placeholder value.\n' +
    '  Set a real key in backend/.env or your hosting platform env vars.\n',
  );
  process.exit(1);
}

export const ENV = {
  port:             parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv:          process.env.NODE_ENV ?? 'development',
  frontendUrl:      process.env.FRONTEND_URL ?? 'http://localhost:3000',
  deepseekApiKey:   deepseekKey,
  deepseekApiUrl:   process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/v1',
  /** Log the computed passphrase to stdout on startup (dev convenience). */
  logPassphrase:    (process.env.LOG_PASSPHRASE ?? 'true').toLowerCase() === 'true',
  enableCheatMode:  process.env.ENABLE_CHEAT_MODE === 'true',
} as const;
