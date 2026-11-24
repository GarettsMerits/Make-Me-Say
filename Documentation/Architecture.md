# Architecture

*Last reviewed against the source: 26 September 2026.*

Don't Make Me Say is two Node processes and a MySQL database. The browser never calls DeepSeek. The browser never supplies the secret word after the session exists.

```
Browser (React, :3000)
    │  JSON or SSE, cookie dmms_access, credentials included
    ▼
Express (:3001)
    │  helmet, cors, json, rate limit
    │  /api/auth/verify          public
    │  authGate                  everything else under /api
    ├─ target word routes ────── MySQL
    ├─ chat route ─ session service ─ MySQL
    │              └─ chat orchestrator ─ DeepSeek (stream)
    └─ leaderboard routes ────── MySQL
```

`GET /health` is outside `/api` and does not require the passphrase. It returns `{ status: 'OK', timestamp }`.

---

## Process and configuration

`backend/src/index.ts` loads `config/env.ts` first, which loads `dotenv` and refuses to boot if `DEEPSEEK_API_KEY` is missing or still has the `sk-your_` placeholder prefix. Other settings fall back if unset:

| Setting | Fallback |
|---|---|
| `PORT` | `3001` |
| `NODE_ENV` | `development` |
| `FRONTEND_URL` | `http://localhost:3000` |
| `DEEPSEEK_API_URL` | `https://api.deepseek.com/v1` |
| `LOG_PASSPHRASE` | off unless the string is `true` |
| `ENABLE_WORD_LIST` | off. `GET /api/target-word/list` stays 403 until this is `true` |
| `TRUST_PROXY` | unset. `true` trusts one hop; a positive integer trusts that many |
| `PASSPHRASE_NAME` | `Adam` (read in the passphrase module, not in `ENV`) |
| `ENABLE_CHEAT_MODE` | off, unless the string is exactly `true` |
| `CHEAT_TRIGGER` | `philliburton` |
| `DB_HOST` / `PORT` / `USER` / `NAME` | `localhost` / `3306` / `root` / `dont_make_me_say` |
| `DB_PASSWORD` | empty string if unset. Not validated at startup |

`config/env.ts` loads dotenv and builds a `ModelRoster`. If `OPENROUTER_API_KEY` is set, chat goes to OpenRouter and each difficulty has its own model slug. Otherwise the direct DeepSeek key is used and every difficulty uses `deepseek-chat` unless `LLM_MODEL_*` overrides it. Timeouts (30s standard, 60s stream) live in `config/llm.ts`. The chat orchestrator overrides temperature to 0.7 for a normal turn and 0.9 for the loss turn, and caps the loss turn at 300 tokens. OpenRouter requests set `reasoning.enabled` to false.

Database pool: `mysql2/promise`, limit 10, keep-alive. A failed initial connection is logged and does not by itself exit; schema init then fails and the process exits. SIGINT and SIGTERM free the tiktoken encoder and exit. They do not drain HTTP connections.

On startup the server reads `database/schema.mysql`, splits on semicolons, skips `CREATE DATABASE` and `USE`, and runs the rest. "already exists" errors are ignored. That is a bootstrap, not a migration. Columns added after a table was first created are not applied here.

---

## HTTP API

Protected routes read the `dmms_access` cookie. The value is an HMAC of the current passphrase (`dont-make-me-say-access-v1`), compared in constant time. The month name is always English (`en-US`). A production process sets `SameSite=None; Secure`. Development sets `SameSite=Lax`. The cookie is HttpOnly.

`POST /api/auth/verify` is public. A match sets the cookie. `GET /api/auth/me` reports whether the cookie is still valid. `POST /api/auth/logout` clears it. The raw passphrase is not accepted on later requests.

Rate limiting runs before routing, in memory, keyed by `req.ip` (the socket address unless `TRUST_PROXY` is set):

- `POST /api/auth/verify`: 10 requests per 60 seconds.
- `POST /api/target-word/reroll`: 1 000 requests per hour.
- Everything else: 100 requests per 60 seconds.

The limiter resets on process restart. `api_usage` exists in the schema and is never written.

### `POST /api/auth/verify`

Body `{ passphrase }`. `200 { success: true }` and a `Set-Cookie` header, or `401 { success: false, message: 'Invalid passphrase' }`.

### `GET /api/target-word?difficulty=`

Counts active rows (optional difficulty predicate), then `ORDER BY id LIMIT 1 OFFSET n` with `n` a random integer in range. `OFFSET` cannot be a bound parameter in this `mysql2` prepared-statement path, so it is inlined after `Math.trunc`. Response: `{ id, word, difficulty }`. `404` if the count is zero. `assignment_count` is incremented in a fire-and-forget update. The browser shares one in-flight request per difficulty, so a remounted page does not deal a second word.

`difficulty` is ignored unless it is `easy`, `normal`, `hard`, or `nightmare`.

### `POST /api/target-word/reroll`

Body `{ targetWordId }`. Positive integer required. `UPDATE ... reroll_count = reroll_count + 1` where the row is active. Zero rows updated is `404`.

### `GET /api/target-word/list`

`403` unless `ENABLE_WORD_LIST=true`. `NODE_ENV=development` is not enough. Otherwise every word, difficulty, and `is_active` flag.

### `POST /api/chat`

Body is either `{ targetWordId, message }` (no session yet) or `{ sessionId, message }`. `message` must be a non-empty string of at most 4 000 characters.

Success switches the response to `text/event-stream` and writes:

| Event | Payload | When |
|---|---|---|
| `meta` | `{ sessionId }` | Immediately, before the model is called |
| `chunk` | `{ text }` | Each streamed delta of the main reply |
| `done` | `{ sessionId, tokenCount, userTokenCount, totalTokens, playerTokens, gameOver, targetWordDetected, llmVictoryMessage? }` | After the exchange is persisted. `tokenCount` is the model reply. `userTokenCount` is this player message. `playerTokens` is the player-only running total and is the score. `totalTokens` still includes model tokens. `llmVictoryMessage` is the full reply, only if `gameOver` |
| `loss-chunk` | `{ text }` | Deltas of the loss acknowledgement |
| `loss-done` | `{ text }` | Full loss text (may be empty if that call failed) |
| `error` | `{ error }` | Main-stream failure after SSE has started |

Validation failures (400 / 404 / 409) are normal JSON, before SSE. `persistExchange` runs in a transaction. The first turn also increments `total_games_played` in that transaction. If the write fails, the route emits `error` and does not emit `done`. The client then removes the optimistic bubbles. A stream from the model that never sends a newline is rejected once the pending line passes 1 MB. The API does not serve a stored transcript. The browser keeps the conversation it already rendered.

### `POST /api/chat/abandon`

Body `{ sessionId }`. The id must match `^[A-Za-z0-9-]{8,64}$`. Sets `completed` on a session that is still in progress and has not been submitted. A finished session is left as it is, so a win can still be submitted. The reset dialog calls this before clearing local state.

### `POST /api/chat/decline`

Body `{ sessionId }`, same id rule. Sets `declined` and leaves the conversation in place. It does not set `completed`. A later score submit for that session is refused. Reset can still end the round.

### `GET /api/leaderboard?limit=&offset=&difficulty=`

`limit` defaults to 10 and is clamped to 1–100. `offset` defaults to 0 and is clamped to 0–10 000. Both are inlined as integers. The query reads one extra row so the response can set `hasMore`. Optional difficulty filter. Ordered by token count, then completion time.

### `GET /api/leaderboard/rank/:tokenCount?difficulty=`

`rank` is `count(token_count < submitted) + 1` inside one difficulty, so ties share a place. `total` is the size of that same set. An empty table returns rank 1.

### `POST /api/leaderboard`

Body is `{ playerName, sessionId }`. The name is trimmed and at most 32 characters. The session id is required.

The service locks the session row, requires a stored model reply that contains the target as a whole word, and computes the token count, word, difficulty, and victory text itself. A declined session is refused. It inserts one row, sets `score_submitted`, and returns `{ id, rank, tokenCount, targetWord, difficulty }`. Rank uses the same strict-less-than rule as `GET .../rank`, scoped to that difficulty. A missing session is 404. A session that is not a win is 400. A second insert for the same session is 409, including a unique-index collision.

### `GET /api/leaderboard/stats`

`totalGames`, rounded average tokens, min, max, and the five `target_word` values with the most rows. Optional `difficulty` query filters both the aggregate and the popular-word list.

500 responses on these routes use a fixed sentence. `HttpError` messages are the exception and are written to be shown.

---

## One chat turn

`resolveSession`:

- No `sessionId`: require `targetWordId`, load the active word, mint `crypto.randomUUID()`, keep an empty transcript. Nothing is written yet.
- With `sessionId`: if that session already has a turn in flight in this process, 409 before any model call. Otherwise load the row. 404 if absent. 409 if `completed`. Parse `messages` (mysql2 may already have parsed the JSON column).

The in-flight gate is released when the turn finishes or fails. The later `UPDATE` also requires the `current_tokens` value that was read, so a second process cannot replace a transcript that was saved first.

`runTurn`:

1. If cheat mode is on and the player text contains the trigger, the system prompt is `buildCheatPrompt`. Otherwise `buildNormalPrompt`. The loss turn later uses `buildLossPrompt` and ignores cheat mode because loss mode is checked first.
2. Stream the difficulty's model with the system prompt plus the stored transcript plus the new user message. Deltas are forwarded as `chunk`. The full exchange is stored on `game_sessions`. A sweep deletes the oldest of those rows once the database is at or over 1 GiB. Leaderboard rows, including the winning reply, are not part of that delete. A conversation touched in the last 15 minutes is kept.
3. Count tokens. Detect the word. `persistExchange` appends both messages and either inserts or updates `game_sessions`, including `difficulty`. The first insert also increments `total_games_played` in the same transaction. A failed write throws and the route emits `error` instead of `done`.
4. Emit `done`, including `playerTokens`.
5. On a win, look up the rank inside that difficulty from the player-only total and stream the loss prompt.

DeepSeek's own SSE is parsed in `llm.ts` (split on newlines, `data:` payloads, stop on `[DONE]`). The browser parses the app's SSE in `SseParser` (split on blank lines). Malformed JSON lines are skipped in both places.

Axios errors become short `Error` messages: invalid key, upstream 429, timeout, or `LLM service error: …`.

---

## Prompts

All three builders live under `backend/src/prompts/` and interpolate the target word into the string. They are the whole of the model's instructions; there is no separate tool or grammar constraint.

**Normal** (`buildNormalPrompt`). Adversarial conversation. Never emit the target in an assistant message. The user saying it does not lose. Deflect direct questions. Voice is taunting and "terminally online" but PG-13. Dodge with misspellings, homophones, leetspeak, symbols, or ASCII. Refuse inappropriate user prompts. The prompt explicitly defines `user` versus `assistant` roles because the model was attributing the forbidden word to the wrong speaker.

**Cheat** (`buildCheatPrompt`). Say the word immediately, more than once if it wants, no refusal.

**Loss** (`buildLossPrompt`). The previous assistant message already contained the word. Acknowledge that, stay in character, do not claim the user was the one who said it. Includes an ordinal rank and the size of the leaderboard. A synthetic user message is also injected into the loss history: a "[GAME OVER — Word Detection System]" line that states the detection again, so the model cannot treat the loss as the player's words.

---

## Frontend state and data flow

### Stores

`useGameStore` (`localStorage` key `game-session`), persist partialize:

- Kept: `messages`, `sessionTokens`, `targetWord`, `targetWordId`, `difficulty`, `sessionId`, `victoryState`, `scoreSubmitted`, `draft`, `scoreName`
- Dropped: `isLoading` (always starts false), `isWon`, `wonRank`, `victoryMessage`

`useUIStore` (`ui-preferences`) persists the entire state: `isDarkMode`, `currentPage`, `pendingHighlightId`, `hasSeenGame`.

`usePageTransitions` is not a store. It compares the previous and next page index and returns Framer Motion variants.

### Hooks

`useChatLogic` owns the difficulty dialog flag, the target-word fetch, submit, reset, reroll, and the win restore.

Fetch effect: if there is no difficulty, do nothing. If word and id are both set, do nothing. If the word is set and the id is null (a session persisted before ids existed), reset. Otherwise `GET /api/target-word?difficulty=`.

Submit: refuse an empty draft or a double-send while `isLoading`. If there is no session and no word id yet, show an error and retry the fetch with the selected difficulty. Otherwise `flushSync` adds the user bubble, adds the client token estimate, adds an empty model bubble, and sets loading, then opens the SSE stream. `flushSync` exists so a fast local model cannot paint its first token before the user bubble.

`onDone` replaces the session total with `playerTokens` and the last user bubble's count with `userTokenCount`. On `gameOver` it stores the victory reply, fetches rank with `playerTokens` and the current difficulty, and sets the victory state to `prompt`. An `error` event before `done` removes the optimistic bubbles, restores the draft, and drops a session id that this turn just created.

Reset of an existing game calls `POST /api/chat/abandon` and then clears the store. The win-restore effect waits until messages exist and loading is false, then runs once. It does not clear `scoreSubmitted`. A game that was already submitted stays on the locked composer.

The composer draft and the victory-bar name live in the game store. The leaderboard tab lives in the UI store. `useBottomBar` owns the decline confirm. `handleScoreSubmit` posts `{ playerName, sessionId }` and then shows the server's `tokenCount` and `rank`.

### API client

`utils/api/client.ts` sends `credentials: 'include'` and does not store the passphrase. `verifyPassphrase` posts the candidate. `checkSession` calls `GET /api/auth/me`. `utils/api.ts` re-exports the barrel in `utils/api/index.ts`.

The draft estimate in `utils/tokenCounter.ts` is a character ratio. Whole-word matching on the client is `utils/TargetWordMatcher.ts`, the same rule as the server class.

### Layout constants

`styles/chatLayout.ts` is the contract between bubbles and the composer: `max-w-4xl`, 56px button column, 120px textarea, and a 180px minimum for the bottom bar. The bar can grow past that minimum.

---

## Database

Engine InnoDB, database charset `utf8mb4` / `utf8mb4_unicode_ci`. That collation makes `word` uniqueness case-insensitive, which matches the seed script's lowercasing.

### `target_words`

| Column | Role |
|---|---|
| `id` | Surrogate key. This is what the client sends on the first turn |
| `word` | Unique, varchar 100 |
| `difficulty` | `easy`, `normal`, `hard`, `nightmare`. Default `normal` |
| `is_active` | Soft delete. Fetches and new sessions require true |
| `assignment_count` | Deals |
| `reroll_count` | Rerolls before any message |
| `total_games_played` | Sessions that received a first message |
| `win_count` | Leaderboard inserts that updated this word string |
| `avg_tokens_to_win` | Running average. `win_count` is assigned last in the `UPDATE`, so the average expression still sees the previous count |
| `max_tokens_to_win` / `min_tokens_to_win` | Extremes of the submitted token count |

### `game_sessions`

| Column | Role |
|---|---|
| `id` | UUID string, primary key |
| `target_word` | Snapshot of the word, not a foreign key |
| `difficulty` | Written on insert and on every later persist. Older rows may still say `normal` until the next turn or a submit, which also looks the word up in `target_words` |
| `current_tokens` | Player plus model tiktoken totals |
| `messages` | JSON array of `{ sender: 'user' \| 'llm', text, tokenCount }` |
| `completed` | Set true on a detected win, and on `POST /api/chat/abandon` for a game the player reset |
| `score_submitted` | Set true after a leaderboard insert that included this id |
| `created_at`, `last_activity` | Timestamps. No job deletes old rows |

### `leaderboard`

| Column | Role |
|---|---|
| `player_name` | varchar 255. API and UI both reject above 32 characters |
| `token_count` | Player-only tiktoken sum from the session |
| `target_word` | Word stored on the session |
| `difficulty` | Difficulty of that word, falling back to the session column |
| `llm_victory_message` | First stored model reply that contains the word as a whole word |
| `completed_at` | Insert time |
| `session_id` | Nullable so old rows can stay. Unique when present. Not a declared foreign key |

Indexes: `token_count`, `completed_at`, `target_word`, `difficulty`, and composite `(difficulty, token_count)`.

### `api_usage`

`ip_address`, `endpoint`, `timestamp`, `user_agent`. Unused. Rate limiting does not read or write it.

### Migrations

Two scripts, neither invoked by the server. They were updated in parallel and still do not call each other.

- `database/migrate.sql` — stored procedure. Adds the stat columns, difficulty, victory message, `score_submitted`, `leaderboard.session_id`, its unique index, and `idx_diff_tokens`.
- `database/migrate.cjs` — Node script. Loads `backend/.env`, uses the `mysql2` package next to the backend, and applies the same column and index changes, including the `difficulty_level` → `difficulty` rename.

A database created from the current `schema.mysql` already has those columns. An older database needs one of these scripts. The unique index fails if two existing rows already share a non-null `session_id`. Startup still only creates missing tables; it does not add columns to a table that already exists.

---

## Security model as built

| Control | What it actually does |
|---|---|
| Passphrase | Shared monthly secret, exchanged once for an HttpOnly HMAC cookie. Hides the UI and the API. Not a user identity |
| Helmet | Default secure headers on the API, with `Cross-Origin-Resource-Policy: cross-origin` so the SPA can read it |
| CORS | Reflects only `FRONTEND_URL`, credentials allowed, because the cookie is cross-origin in development |
| Rate limit | Per-process ceilings described above. `TRUST_PROXY` must be set before `req.ip` is the visitor |
| SQL | Bound parameters for user values. Integer-inlined `LIMIT` / `OFFSET` |
| Secret word | Resolved server-side from `targetWordId`, then from the session row |
| Score integrity | Name and session id from the client. Count, word, difficulty, and quote from the locked session. One row per session id |
| API key | Stays in `backend/.env` and in process memory. Requests to DeepSeek are server-side |

Threats this does not close are listed in [Issues](Issues.md).

---

## Automated checks

- `frontend/src/App.test.tsx` expects the passphrase field. `npm test` runs that suite.
- `backend` `npm test` runs the domain, access-token, and line-buffer tests with `node --import tsx --test`.
- CI builds both packages and runs both test suites. Backend lint is `npm run lint || echo ...` and there is no lint script. Deploy jobs echo a line. The front-end `npm audit` is reported and does not fail the job. The backend audit still fails the job on a moderate or higher advisory.

---

## Extension points that are real

- A new page is a `PageType` member, a `switch` case in `MainApplication`, a ribbon item, and an entry in `usePageTransitions`'s `pageOrder`. The `never` default in the switch fails the build if a page is forgotten.
- Prompt edits are confined to `backend/src/prompts/`.
- Another OpenAI-compatible chat endpoint can be pointed at by `DEEPSEEK_API_URL` and `LLM_CONFIG.model` if it speaks the same streaming chunk shape. Token counting still assumes cl100k. The rest of the game does not know the vendor. A local server is the same kind of change only if it implements that HTTP API.
- Swapping `RateLimiterMemory` for `RateLimiterRedis` is local to `rateLimiter.ts`, as the file's own comment says. Nothing else is ready for more than one Node process (in-memory limiter, no sticky sessions required for SSE beyond a single process).
