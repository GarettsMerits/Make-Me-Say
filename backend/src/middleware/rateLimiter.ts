/**
 * Rate-limiting middleware
 *
 * Three separate in-memory buckets:
 *  - `auth`     — 10 requests / 60 s per IP   (POST /api/auth/verify only)
 *  - `general`  — 100 requests / 60 s per IP  (everything else)
 *  - `reroll`   — 1 000 requests / 3 600 s per IP  (POST /api/target-word/reroll only)
 *
 * Swap RateLimiterMemory for RateLimiterRedis here if the app ever scales
 * beyond a single process — no other file needs to change.
 */
import type { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const authLimiter    = new RateLimiterMemory({ points: 10,   duration: 60   });
const generalLimiter = new RateLimiterMemory({ points: 100,  duration: 60   });
const rerollLimiter  = new RateLimiterMemory({ points: 1000, duration: 3600 });

/**
 * Express middleware that selects the appropriate bucket based on route and
 * responds with 429 when the budget is exhausted.
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.ip ?? 'unknown';
  const limiter = req.method === 'POST' && req.path === '/api/target-word/reroll'
    ? rerollLimiter
    : req.method === 'POST' && req.path === '/api/auth/verify'
      ? authLimiter
      : generalLimiter;

  try {
    await limiter.consume(key);
    next();
  } catch {
    res.status(429).json({ error: 'Too many requests' });
  }
}
