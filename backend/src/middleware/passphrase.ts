/**
 * passphrase.ts — monthly-rotating passphrase auth.
 *
 * Exports:
 *   computePassphrase()  — derives "Adam{Month}{Year}" for the current month
 *   authGate             — Express middleware; rejects requests without a valid x-passphrase header
 *   default export       — Express router for POST /api/auth/verify (public)
 *
 * The passphrase rotates on the first of each month. The same function is used
 * by both the gate and the verify endpoint so they can never disagree.
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

// ─── Passphrase logic ─────────────────────────────────────────────────────────

export function computePassphrase(): string {
  const now   = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const name  = process.env.PASSPHRASE_NAME ?? 'Adam';
  return `${name}${month}${now.getFullYear()}`;
}

// ─── Auth gate middleware ─────────────────────────────────────────────────────

/**
 * Rejects requests whose `x-passphrase` header does not match the current
 * monthly passphrase. Attach to any router or route that needs protection.
 */
export function authGate(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-passphrase'] === computePassphrase()) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid passphrase' });
  }
}

// ─── Auth router (/api/auth) ──────────────────────────────────────────────────

const router = express.Router();

/** POST /api/auth/verify — lets the frontend check whether its passphrase is current. */
router.post('/verify', (req: Request, res: Response) => {
  if (req.body?.passphrase === computePassphrase()) {
    res.json({ success: true, message: 'Access granted' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid passphrase' });
  }
});

export default router;
