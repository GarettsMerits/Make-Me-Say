# Don't Make Me Say

A full-stack web game. A target word sits above a chat with an LLM that has been told never to say it. You win by making it say that word anyway. Score is the number of tokens in your own messages — lower is better — and a win can be posted to a per-difficulty leaderboard.

The site is a private portfolio project. Nothing about the game is shown until a monthly passphrase is accepted.

Detailed design lives in `Documentation/`:

| Document | What it covers |
|---|---|
| [Overview](Documentation/Overview.md) | Product intent, screens, and how the interface actually behaves |
| [Gameplay](Documentation/Gameplay.md) | Difficulties, scoring, win detection, leaderboard presentation |
| [Architecture](Documentation/Architecture.md) | Frontend, backend, database, API, prompts, and request flows |
| [Development plan](Documentation/Development_and_Implementation_Plan.md) | What is built, what is not, and the original delivery plan |
| [Issues](Documentation/Issues.md) | Unfinished work, bugs, design problems, and security findings |

---

## Features that work today

- **Four difficulties** — Easy, Normal, Hard, and Nightmare, each drawn from its own word list. A dialog asks for a difficulty before the first game and again on reset.
- **Streaming chat** — The model replies over server-sent events. The server, not the browser, owns the target word and the conversation history.
- **Win sequence** — When the model's reply contains the target word as a whole word, that word animates in the bubble, the instruction line changes, and a win-flow bar offers score submission or a decline.
- **Leaderboard** — Rankings per difficulty (plus an All tab), lowest token count first, with the winning model message shown on one line.
- **Passphrase gate** — `{PASSPHRASE_NAME}{Month}{Year}` (for example `AdamSeptember2026`). The value is checked on the server for every protected request.
- **Theme and navigation** — Light and dark mode without a reload. Chat, How To Play, Leaderboard, and About slide horizontally. Chat messages survive navigation and refresh via `localStorage`.
- **Reroll** — Before any message is sent, a large control in the empty chat requests a new word and records the reroll.
- **Developer cheat mode** — Optional env flag. A trigger substring forces a prompt that tells the model to say the target word. Leave it off outside local testing.

While you type, the composer shows a local estimate of the draft. After each turn the session total is replaced with the server's count of your own tokens. A submitted score is that same count, read from the stored session. The server does not accept a token total, word, or victory quote from the browser. See [Issues](Documentation/Issues.md) for what is still unfinished.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand, React Router DOM (installed; page changes are store-driven, not URL routes) |
| Backend | Node.js, Express 4, TypeScript (`tsx` in development, `tsc` for production) |
| Database | MySQL 8.0 via `mysql2` connection pool |
| LLM | OpenRouter, one model per difficulty, when `OPENROUTER_API_KEY` is set. Direct DeepSeek `deepseek-chat` is the fallback. Streaming, called only from the server. See [Model roster](Documentation/Model_Roster.md) |
| Token counting | `tiktoken` (`cl100k_base` via the gpt-4 encoding) on the server, player messages only. The browser estimates a draft locally and does not ship `tiktoken` |
| HTTP hardening | Helmet, CORS locked to `FRONTEND_URL`, `rate-limiter-flexible` in memory (100 requests / 60 s general, 1 000 rerolls / hour) |

---

## Project structure

```
├── backend/
│   ├── src/
│   │   ├── auth/            # HttpOnly access-cookie token
│   │   ├── config/          # env.ts (validated secrets), llm.ts (model and timeouts)
│   │   ├── db/              # connection pool, schema bootstrap on startup
│   │   ├── domain/          # word match, player score, rank, request limits
│   │   ├── http/            # client-safe errors
│   │   ├── middleware/      # passphrase gate + /api/auth, rate limiter
│   │   ├── prompts/         # normal, cheat, and loss system prompts
│   │   ├── routes/          # target word, chat (SSE), leaderboard
│   │   └── services/        # session, chat orchestration, LLM client, leaderboard
│   ├── words/               # easy.csv, normal.csv, hard.csv, nightmare.csv
│   ├── scripts/seedWords.ts
│   └── .env.example
├── frontend/src/
│   ├── components/          # gate, ribbon, pages, chat, leaderboard
│   ├── hooks/               # useChatLogic, useBottomBar
│   ├── store/               # Zustand game + UI stores, page-slide hook
│   ├── styles/chatLayout.ts # shared widths so bubbles line up with the input
│   └── utils/api/           # typed client for every endpoint
├── database/
│   ├── schema.mysql         # full schema applied on a fresh database
│   ├── migrate.sql          # idempotent stored-procedure migration
│   └── migrate.cjs          # idempotent Node migration; reads backend/.env
└── start-test.bat           # Windows: deps, MySQL80 service, both servers
    start-test.js            # cross-platform: deps and both servers (does not start MySQL)
```

---

## Local setup

### Prerequisites

- Node.js 18 or later
- MySQL 8.0 running locally. `start-test.bat` expects the Windows service name `MySQL80`
- An OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys), or a DeepSeek API key from [platform.deepseek.com](https://platform.deepseek.com/)

### 1 — Clone

```bash
git clone https://github.com/GarettsMerits/Make-Me-Say.git
cd Make-Me-Say
```

### 2 — Configure the backend

```bash
cd backend
cp .env.example .env
```

| Variable | What to set |
|---|---|
| `DB_PASSWORD` | MySQL password for `DB_USER` (default user `root`) |
| `OPENROUTER_API_KEY` | Preferred key. When it is set, each difficulty uses the roster. A value that is empty or starts with `your_` does not count |
| `DEEPSEEK_API_KEY` | Fallback key, used only when the OpenRouter key is absent. Startup exits if both keys are missing or still placeholders |
| `PASSPHRASE_NAME` | Prefix of the monthly passphrase. Default in code is `Adam` if unset |
| `LOG_PASSPHRASE` | `true` prints the current passphrase on startup. The default is `false` when the variable is omitted |
| `ENABLE_CHEAT_MODE` | `false` unless you are testing wins |
| `CHEAT_TRIGGER` | Substring that activates cheat mode. Default `philliburton` |

`PORT` defaults to `3001`. `FRONTEND_URL` defaults to `http://localhost:3000` and is the only CORS origin.

### 3 — Create the database

From the repo root, against an empty or already-created server:

```bash
mysql -u root -p < database/schema.mysql
```

That file creates `dont_make_me_say` and every table. Startup also runs the same file statement-by-statement (`CREATE TABLE IF NOT EXISTS`), so a database that already exists is left in place. **Existing tables are not altered** by startup. If you have an older database, read the migration warning in [Issues](Documentation/Issues.md) before trusting `database/migrate.cjs`.

### 4 — Seed words

```bash
cd backend
npm install
npx tsx scripts/seedWords.ts
```

The script lowercases each CSV entry and uses `INSERT ... ON DUPLICATE KEY UPDATE`, so it is safe to re-run. The `word` column is unique across all difficulties: a word that appears in two CSVs keeps the difficulty of whichever file was seeded last.

### 5 — Install and start

```bash
cd ../frontend
npm install
```

**Windows:** run `start-test.bat` from the repo root. It installs missing `node_modules`, starts the `MySQL80` service if needed (an elevated prompt is required when the service is stopped), and opens the backend and frontend in their own console windows.

**Manual, any OS:**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```

`npm run dev` at the repo root runs `start-test.js`, which installs dependencies if needed and starts both servers. It does not start MySQL.

### 6 — Open the app

Go to [http://localhost:3000](http://localhost:3000). The passphrase is not printed unless `LOG_PASSPHRASE=true`. The month name is always English (`en-US`), so the secret does not change with the server's locale.

---

## Passphrase

```
{PASSPHRASE_NAME}{Month}{Year}
```

`POST /api/auth/verify` checks the body and sets an HttpOnly cookie named `dmms_access`. The cookie holds an HMAC of the passphrase, not the passphrase. Every other `/api/*` route requires that cookie. The browser also stores a boolean `authenticated` flag in `sessionStorage` so the gate can skip itself; a refresh calls `GET /api/auth/me` and drops the flag if the cookie is missing. Logout calls `POST /api/auth/logout`, which clears the cookie. Verify attempts are limited to 10 per minute per address.

This is an access courtesy, not an account system. The formula is in this repository. See [Issues](Documentation/Issues.md).

---

## Developer cheat mode

```dotenv
ENABLE_CHEAT_MODE=true
CHEAT_TRIGGER=yourSecretWord
```

If enabled, any player message that contains the trigger (case-insensitive substring) swaps in the cheat system prompt for that turn. The backend logs a warning the first time this happens. Do not enable it on a shared server.

---

## Scripts

| Location | Command | Effect |
|---|---|---|
| Repo root | `npm run dev` / `npm run test:start` | `start-test.js` |
| Repo root | `npm run install:all` | `npm install` in `backend/` and `frontend/` |
| `backend/` | `npm run dev` | `tsx watch src/index.ts` |
| `backend/` | `npm run build` && `npm start` | Compile to `dist/`, then `node dist/index.js` |
| `frontend/` | `npm start` | Create React App dev server on port 3000 |
| `frontend/` | `npm run build` | Production bundle in `frontend/build/` |
| `frontend/` | `npm test` | Jest via Create React App. `App.test.tsx` covers the passphrase gate |
| `backend/` | `npm test` | Node's test runner, via `tsx`, for the domain and auth units |

GitHub Actions (`.github/workflows/ci-cd.yml`) installs both packages, runs both test suites, builds both packages, and runs `npm audit`. The backend job's lint step is optional and has no lint script. The deploy jobs print a message and do not deploy. Advisories inside Create React App's dependency tree are reported and do not fail the job. The backend audit still fails the job on a moderate or higher advisory.

---

## Security notes

- `backend/.env` is gitignored. Do not commit API keys or database passwords.
- Only `database/schema.mysql` (structure) is meant to be committed. Data dumps matching `database/dump*.sql` and `database/export*.sql` are gitignored.
- Game and leaderboard routes reject requests that do not present the current access cookie.
- SQL values that come from clients are bound parameters. `LIMIT` and `OFFSET` are interpolated only after `Math.trunc`.
- A leaderboard row is built from the stored session: player-only tiktoken count, target word, difficulty, and the first model reply that contains the word. The request body is a display name and a session id. `leaderboard.session_id` is unique.

---

## License

Private portfolio project — not licensed for redistribution.
