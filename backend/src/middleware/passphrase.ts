/**
 * Monthly passphrase gate.
 *
 * POST /api/auth/verify checks the passphrase and sets an HttpOnly cookie.
 * The cookie holds an HMAC of the current passphrase, not the passphrase.
 * Every other protected route reads that cookie.
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AccessToken } from '../auth/AccessToken.js';

export function computePassphrase(): string {
  const now   = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const name  = process.env.PASSPHRASE_NAME ?? 'Adam';
  return `${name}${month}${now.getFullYear()}`;
}

function cookieIsSecure(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function requestIsAuthorized(req: Request): boolean {
  const token = AccessToken.read(req.headers.cookie);
  if (!token) return false;
  return AccessToken.matches(token, computePassphrase());
}

export function authGate(req: Request, res: Response, next: NextFunction): void {
  if (requestIsAuthorized(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Invalid passphrase' });
}

const router = express.Router();

/** POST /api/auth/verify — exchange a passphrase for an access cookie. */
router.post('/verify', (req: Request, res: Response) => {
  const candidate = typeof req.body?.passphrase === 'string' ? req.body.passphrase : '';
  if (!AccessToken.passphraseMatches(candidate, computePassphrase())) {
    res.status(401).json({ success: false, message: 'Invalid passphrase' });
    return;
  }
  res.setHeader('Set-Cookie', AccessToken.setCookie(computePassphrase(), cookieIsSecure()));
  res.json({ success: true, message: 'Access granted' });
});

/** GET /api/auth/me — used by the SPA on refresh to see if the cookie is still valid. */
router.get('/me', (req: Request, res: Response) => {
  if (!requestIsAuthorized(req)) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true });
});

/** POST /api/auth/logout — clears the access cookie. */
router.post('/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', AccessToken.clearCookie(cookieIsSecure()));
  res.json({ success: true });
});

export default router;
