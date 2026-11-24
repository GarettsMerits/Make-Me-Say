import crypto from 'crypto';

const COOKIE_NAME = 'dmms_access';
const PURPOSE = 'dont-make-me-say-access-v1';

/**
 * Proves the browser presented the current monthly passphrase.
 * The cookie stores an HMAC, not the passphrase itself.
 */
export class AccessToken {
  static issue(passphrase: string): string {
    return crypto.createHmac('sha256', passphrase).update(PURPOSE).digest('hex');
  }

  static matches(token: string, passphrase: string): boolean {
    if (!/^[a-f0-9]{64}$/i.test(token)) return false;
    return timingSafeEqualString(token.toLowerCase(), AccessToken.issue(passphrase));
  }

  static passphraseMatches(candidate: string, expected: string): boolean {
    return timingSafeEqualString(candidate, expected);
  }

  static read(cookieHeader: string | undefined): string | undefined {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
      const separator = part.indexOf('=');
      if (separator === -1) continue;
      const key = part.slice(0, separator).trim();
      if (key !== COOKIE_NAME) continue;
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  static setCookie(passphrase: string, secure: boolean): string {
    return serialize(AccessToken.issue(passphrase), secure, false);
  }

  static clearCookie(secure: boolean): string {
    return serialize('', secure, true);
  }
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function serialize(value: string, secure: boolean, clear: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Path=/',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  if (clear) parts.push('Max-Age=0');
  return parts.join('; ');
}
