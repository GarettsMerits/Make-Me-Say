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
import express from 'express';
import type { Request, Response } from 'express';
import cors    from 'cors';
import helmet  from 'helmet';

import { ENV }                   from './config/env.js';
import { rateLimitMiddleware }   from './middleware/rateLimiter.js';
import { computePassphrase }     from './middleware/passphrase.js';
import apiRouter                 from './routes/index.js';
import { initializeDatabase, checkDatabaseHealth } from './db/init.js';
import { cleanup as cleanupLLM } from './services/llm.js';

//  App setup ─

const app = express();

app.use(helmet());
app.use(cors({ origin: ENV.frontendUrl, credentials: true }));
app.use(express.json());
app.use(rateLimitMiddleware);

//  Routes 

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api', apiRouter);

//  Startup 

async function startServer(): Promise<void> {
  await initializeDatabase();
  await checkDatabaseHealth();

  app.listen(ENV.port, () => {
    console.log(` Server running on port ${ENV.port} (${ENV.nodeEnv})`);
    if (ENV.logPassphrase) {
      console.log(`[debug] Current passphrase: ${computePassphrase()}`);
    }
    console.log(' API endpoints ready:');
    console.log('   POST /api/auth/verify');
    console.log('   GET  /api/target-word');
    console.log('   POST /api/chat');
    console.log('   GET  /api/leaderboard');
    console.log('   POST /api/leaderboard');
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

//  Graceful shutdown 

function shutdown(signal: string): void {
  console.log(`${signal} received  shutting down gracefully`);
  cleanupLLM();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
