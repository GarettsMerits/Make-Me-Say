import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AccessToken } from './AccessToken.js';

describe('AccessToken', () => {
  const passphrase = 'AdamSeptember2026';

  it('accepts a token issued for the same passphrase', () => {
    const token = AccessToken.issue(passphrase);
    assert.equal(AccessToken.matches(token, passphrase), true);
  });

  it('rejects a token from a different passphrase or a short guess', () => {
    const token = AccessToken.issue(passphrase);
    assert.equal(AccessToken.matches(token, 'AdamOctober2026'), false);
    assert.equal(AccessToken.matches('nope', passphrase), false);
  });

  it('reads the access cookie and ignores unrelated cookies', () => {
    const token = AccessToken.issue(passphrase);
    const header = `theme=dark; dmms_access=${token}; other=1`;
    assert.equal(AccessToken.read(header), token);
    assert.equal(AccessToken.read(undefined), undefined);
  });

  it('compares passphrases without accepting a different length as equal', () => {
    assert.equal(AccessToken.passphraseMatches(passphrase, passphrase), true);
    assert.equal(AccessToken.passphraseMatches('nope', passphrase), false);
  });

  it('marks a cleared cookie as expired', () => {
    assert.match(AccessToken.clearCookie(false), /Max-Age=0/);
    assert.match(AccessToken.setCookie(passphrase, true), /Secure/);
    assert.doesNotMatch(AccessToken.setCookie(passphrase, false), /Secure/);
  });
});
