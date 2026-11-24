/**
 * Application entry point  intentionally thin.
 *
 * Responsibility: compose middleware, mount routers, start the HTTP server.
 * All business logic, configuration, and middleware details live in their
 * own modules.
 *
 *   config/env.ts               validated env vars (dotenv loaded here)
 *   middleware/rateLimiter.ts   per-route rate limiting
 *   middleware/passphrase.ts    passphrase auth gate + /api/auth router
 *   routes/index.ts             all /api/* routers composed together
 *   db/init.ts                  schema init & health check
 *   services/llm.ts             LLM client cleanup
 */
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import type { Request, Response } from 'express';
import cors    from 'cors';
import helmet  from 'helmet';

import { ENV, modelRoster }      from './config/env.js';
import { rateLimitMiddleware }   from './middleware/rateLimiter.js';
import { computePassphrase }     from './middleware/passphrase.js';
import apiRouter                 from './routes/index.js';
import { initializeDatabase, checkDatabaseHealth } from './db/init.js';
import { cleanup as cleanupLLM } from './services/llm.js';
import pool from './db/connection.js';
import { mysqlConversationRetention } from './services/conversationRetentionMysql.js';

//  App setup ─

const app = express();

// The SPA is a different origin from this API. Helmet's default
// Cross-Origin-Resource-Policy of same-origin would block those responses.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: ENV.frontendUrl, credentials: true }));
if (ENV.trustProxy !== false) {
  app.set('trust proxy', ENV.trustProxy);
}
app.use(express.json());
app.use(rateLimitMiddleware);

//  Routes 

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api', apiRouter);

//  Startup 

async function startServer(): Promise<void> {
  if (process.env.SIMULATE_MODEL === 'true') {
    console.error(
      'SIMULATE_MODEL plays without calling a model. Run npm run simulate, which uses its own database.',
    );
    process.exit(1);
  }
  await initializeDatabase();
  await checkDatabaseHealth();

  app.listen(ENV.port, () => {
    console.log(` Server running on port ${ENV.port} (${ENV.nodeEnv})`);
    if (ENV.logPassphrase) {
      console.log(`[debug] Current passphrase: ${computePassphrase()}`);
    }
    console.log(' API endpoints ready:');
    console.log('   POST /api/auth/verify');
    console.log('   GET  /api/auth/me');
    console.log('   POST /api/auth/logout');
    console.log('   GET  /api/target-word');
    console.log('   POST /api/chat');
    console.log('   POST /api/chat/abandon');
    console.log('   GET  /api/leaderboard');
    console.log('   POST /api/leaderboard');
    console.log(` LLM provider: ${modelRoster.name}`);
    console.log(modelRoster.describe());
    startConversationRetention();
  });
}

const RETENTION_INTERVAL_MS = 15 * 60 * 1000;
let retentionTimer: NodeJS.Timeout | undefined;

function startConversationRetention(): void {
  const retention = mysqlConversationRetention(pool, ENV.dbSizeLimitBytes);
  const run = (): void => {
    retention.enforce()
      .then((removed) => {
        if (removed > 0) {
          console.log(`Removed ${removed} old conversation${removed === 1 ? '' : 's'} to stay under the database size limit.`);
        }
      })
      .catch((err) => console.error('Conversation retention failed:', err));
  };
  run();
  retentionTimer = setInterval(run, RETENTION_INTERVAL_MS);
  retentionTimer.unref();
}

function shutdown(signal: string): void {
  console.log(`${signal} received  shutting down gracefully`);
  if (retentionTimer) clearInterval(retentionTimer);
  cleanupLLM();
  process.exit(0);
}

const entry = process.argv[1];
const startedDirectly = entry !== undefined
  && path.resolve(entry) === fileURLToPath(import.meta.url);

if (startedDirectly) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { app };
