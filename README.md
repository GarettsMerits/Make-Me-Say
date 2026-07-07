# Don't Make Me Say

A full-stack web game where you try to trick an LLM into saying a word it's been explicitly told to avoid.

A target word is displayed at the top of the chat interface. The LLM has been prompted to never say it. Your goal is to craft messages clever enough to make it slip up anyway. Win, and your score, measured in how many tokens of input it took you, is posted to the leaderboard.

> **Note:** This project is actively in development. Core gameplay, the passphrase gate, leaderboard, and difficulty system are functional. Some planned features (post-win leaderboard navigation, session win-rehydration on reload) are partially or not yet implemented.

---

## Features

- **Four difficulty levels** — Easy (common articles/pronouns), Normal (everyday nouns and verbs), Hard (specific but recognizable vocabulary), Nightmare (obscure and technical words)
- **Live token counter** — Tracks your input token budget as you type and shows your projected leaderboard rank before you even send a message
- **Leaderboard** — Per-difficulty rankings scored by total player input tokens, lowest wins; includes the exact LLM message that gave the game away
- **Win sequence** — The target word in the winning LLM message is animated with a letter-wave and a rank-coloured shimmer (gold/silver/bronze)
- **Passphrase gate** — The entire site is hidden behind a monthly rolling passphrase; nothing is visible before authentication
- **Session persistence** — Navigating away from the chat and back preserves your conversation state
- **Dark / light mode** — Full theme toggle with no page reload
- **Smooth page transitions** — Horizontal slide animations between Chat, Leaderboard, How to Play, and About
- **Developer cheat mode** — An env-flag-controlled trigger word that forces an instant win (for testing)
- **Responsive layout** — Usable on phones without horizontal scrolling

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| **Backend** | Node.js, Express, TypeScript (`tsx` for dev, `tsc` for prod) |
| **Database** | MySQL 8.0 |
| **LLM** | DeepSeek API (`deepseek-chat`) via streaming SSE |
| **Token counting** | `tiktoken` (backend authoritative) + client-side estimate for live display |
| **Security** | Helmet, CORS, `rate-limiter-flexible` (100 req/min general, 1 000 rerolls/hr) |

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/          # env.ts (validated env vars), llm.ts (API params)
│   │   ├── db/              # connection pool, schema initialization
│   │   ├── middleware/      # passphrase.ts (auth gate), rateLimiter.ts
│   │   ├── prompts/         # LLM system prompt builders
│   │   ├── routes/          # targetWord, chat, leaderboard, router index
│   │   └── services/        # chatOrchestrator, llm, leaderboardService, sessionService
│   ├── words/               # easy.csv, normal.csv, hard.csv, nightmare.csv
│   ├── scripts/             # seedWords.ts — populates target_words from CSVs
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/      # Page components and all chat/leaderboard UI
│       ├── hooks/           # useChatLogic, useBottomBar
│       ├── store/           # Zustand slices (useGameStore, useUIStore)
│       └── utils/api/       # Typed API client (passphrase, chat, leaderboard, targetWord)
├── database/
│   ├── schema.mysql         # Full schema — apply this to create all tables
│   └── migrate.cjs          # Idempotent migration script for existing databases
└── start-test.bat           # Windows: installs deps, starts MySQL, launches both servers
```

---

## Local Setup

### Prerequisites

- **Node.js** 18 or later
- **MySQL 8.0** running locally (the Windows service name is assumed to be `MySQL80` by `start-test.bat`)
- A **DeepSeek API key** — free tier available at [platform.deepseek.com](https://platform.deepseek.com/)

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

Open `backend/.env` and fill in your values:

| Variable | What to set |
|---|---|
| `DB_PASSWORD` | Your MySQL root password |
| `DEEPSEEK_API_KEY` | Your DeepSeek API key |
| `PASSPHRASE_NAME` | **Your name** (or any string) — the site passphrase will be `{name}{Month}{Year}`, e.g. `AliceJune2026` |
| `LOG_PASSPHRASE` | Keep `true` so the current passphrase is printed to the backend console on startup |

All other values can stay as their defaults for local development.

### 3 — Set up the database

```bash
# From the repo root — applies the full schema (safe to run on a fresh or existing DB)
mysql -u root -p < database/schema.mysql
```

If you already have the database from a previous setup and only need to apply migrations:

```bash
node database/migrate.cjs
```

### 4 — Seed the word lists

```bash
cd backend
npm install
npx tsx scripts/seedWords.ts
```

This reads the four CSV files in `backend/words/` and populates the `target_words` table. It is safe to run multiple times (uses `INSERT IGNORE`).

### 5 — Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 6 — Start both servers

**Windows — easiest option:** run `start-test.bat` from the repo root. It will:
- Install any missing `node_modules` in both `backend/` and `frontend/`
- Start the `MySQL80` service if it isn't already running (requires an elevated prompt if MySQL isn't running)
- Open the backend (`localhost:3001`) and frontend (`localhost:3000`) each in their own terminal window

**Manual alternative:**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```

### 7 — Open the app

Navigate to [http://localhost:3000](http://localhost:3000).

The site will prompt for a passphrase. Check the backend terminal — with `LOG_PASSPHRASE=true` the current passphrase is printed on startup:

```
[debug] Current passphrase: AliceJune2026
```

Enter it to access the game.

---

## Passphrase System

The site is protected by a monthly rolling passphrase to limit access to people you've explicitly told about it. The formula is:

```
{PASSPHRASE_NAME}{Month}{Year}
```

Set `PASSPHRASE_NAME` in `backend/.env` to whatever prefix you want. With `PASSPHRASE_NAME=Demo` the June 2026 passphrase would be `DemoJune2026`. The passphrase automatically changes on the first of every month with no code change needed.

---

## Developer Cheat Mode

For testing the win sequence without outsmarting the LLM, set in `backend/.env`:

```dotenv
ENABLE_CHEAT_MODE=true
CHEAT_TRIGGER=yourSecretWord
```

Any message containing the trigger word will force the LLM to immediately say the target word. A warning is printed to the backend console when this is active. **Never enable in production.**

---

## Security Notes

- `backend/.env` is in `.gitignore` — your API key and DB password are never committed
- Database data is never committed — only `database/schema.mysql` (structure) is tracked
- The passphrase gate hides all game content and API endpoints from unauthenticated requests
- Rate limiting: 100 requests/min per IP (general), 1 000 rerolls/hr per IP

---

## License

Private portfolio project — not licensed for redistribution.
