# Issues

*Updated 26 September 2026. This is the remaining list. The September review's score, reload, highlight, migration, and passphrase-storage findings are closed in the current source.*

Severity is about impact on this project: a public leaderboard and a paid LLM key behind a shared passphrase.

| Level | Meaning |
|---|---|
| Medium | Frequent player-visible bug, or a hole that matters once the app is more than one process |
| Low | Dead ends, rough edges, or product work that was named and not built |

The live database has `score_submitted`, `leaderboard.session_id`, and `uniq_leaderboard_session`. One later copy of an identical score was removed so the index could be created. Rows posted under the old submit route are not otherwise rewritten.

---

## Still open

### The passphrase is still a shared, low-entropy secret — Medium

The cookie is HttpOnly and holds an HMAC, and verify is limited to 10 attempts a minute. The secret itself is still name + English month + year, and the formula is in this repository. Anyone who has it can spend the model budget. The API does not serve a stored transcript. That matches a private gate. It is not an account system.

The in-memory limiter is per process. Without `TRUST_PROXY`, a reverse proxy makes every visitor one address. Several processes multiply the budget. `api_usage` is never written.

### Word statistics have no screen — Low

`win_count`, assignment, reroll, games played, and avg/max/min tokens are maintained. No page displays them.

### Other product items that were planned and not built — Low

WebSockets, Cloudflare, URL routing, and a full accessibility pass. Chat can go through OpenRouter, so the model is no longer fixed to one DeepSeek host. Token counting stays on the gpt-4 encoding. Redis is not bundled. A single process does not need it, and current Redis is not the old BSD license. See the reply that recorded that, and [Model roster](Model_Roster.md).

`hasSeenGame` does not navigate. A first visit already opens on How To Play because that is the initial page. The flag only turns the difficulty dialog from a welcome into a reset.

### Schema bootstrap does not understand procedure bodies — Low

Startup splits `schema.mysql` on semicolons that are outside quotes and comments. A stored procedure body would still be split. `migrate.sql` should not be run through that bootstrap.

### Upstream and client stream buffers are capped, not retried — Low

A model stream that never emits a newline is rejected at 1 MB, and the turn fails. The browser parser uses the same cap. Neither side resumes a truncated reply.

### Create React App audit — Low

The front-end tree still reports advisories in dependencies Create React App pins. The workflow reports that audit and continues. The backend audit still fails the security job when it finds a moderate or higher advisory.

### The referee is still an exact whole word — Low

The normal prompt now forbids misspellings, homophones, leetspeak, and broken grammar as a way around the target word. The win check is still a case-insensitive whole word. A model that breaks the new rule and misspells the target does not lose. Easy function words are still trivial when the model slips. The loss prompt spends a second billed completion after the win.

### `assignment_count` counts deals, not games — Low

The counter increments when a word is fetched. The chat page shares one in-flight request per difficulty, so a remount does not deal a second word. A fetch that never becomes a message still counts. A refresh does not refetch when the id and the word are both stored.

---

## Closed in the follow-up

Kept here so the September write-up is not re-opened by accident.

- Leaderboard writes no longer trust `tokenCount`, `targetWord`, `difficulty`, or the victory quote. Those come from the locked session. `session_id` is unique on the live database.
- Rank, the victory copy, the loss prompt, and the stored score all use the player-only tiktoken count inside one difficulty. Ties share a place.
- A reload of a submitted win stays submitted. A declined win stays declined.
- A failed turn removes the optimistic bubbles and restores the draft.
- Highlighting is a whole-word match. The excerpt centres when it fits. The edge fade does not depend on a dark grey colour.
- The word-stat average increments `win_count` last.
- The passphrase is not stored in the page and is not logged unless `LOG_PASSPHRASE=true`. The month name is English. The word list stays off unless `ENABLE_WORD_LIST=true`.
- Chat turns are capped at 4 000 characters. 500 responses do not include driver text.
- A failed session write does not emit `done`. The first message and `total_games_played` commit together.
- Migrations add `score_submitted` and `leaderboard.session_id` and read credentials from `backend/.env`.
- The stale Hello World and "learn react" tests are gone. Backend `npm test` runs in CI.
- A second turn for a session that is already waiting on a reply is refused. The save also requires the token total that was read, so a later write cannot replace an earlier one.
- The leaderboard accepts `offset`. The page loads 100 rows and offers Show more. A new score outside the first page is followed for up to ten further pages.
- The composer draft, the victory-bar name, and the leaderboard difficulty tab survive leaving the page and a refresh.
- Each difficulty can use its own model through OpenRouter. The normal prompt forbids spelling and grammar tricks.
- Full transcripts stay in `game_sessions`. Once the database is at 1 GiB, the oldest conversations are deleted. A submitted scoreboard quote is kept.
- The win-flow bar waits for a real place. It does not show 999th, and the winning word is not painted as 1st, while the rank request is still out.
