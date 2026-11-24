# A session belongs to one browser

The site is gated by a shared monthly passphrase, and there is no player account. A session lives in one browser: sign-out suspends the open deal or round, and only that browser can resume it.

## Considered options

- A player account that could resume a round from any browser. Rejected because the passphrase is the only identity this game has.

## Consequences

A different browser is a different session even when the passphrase matches. If a browser loses its stored session, the open round cannot be resumed. When the monthly passphrase changes, the player must sign in again, and that sign-in resumes the same session.
