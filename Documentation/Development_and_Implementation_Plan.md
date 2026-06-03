# Development & Implementation Plan

*Last updated: June 2026*

---

## Tech Stack

### Frontend

| Technology | Role |
|---|---|
| **React 19 + TypeScript** | SPA framework — strong typing, large ecosystem, industry standard |
| **Zustand** (with `persist` middleware) | Lightweight global state — game session, UI preferences |
| **Framer Motion** | Page slide transitions, win animations, dialog enter/exits |
| **Tailwind CSS** | Utility-first styling, `dark:` prefix for full dark-mode support |
| **tiktoken** (frontend, character-ratio fallback) | Live token estimate in the input field |

### Backend

| Technology | Role |
|---|---|
| **Node.js + TypeScript** | Runtime — chosen for ecosystem fit with the frontend and LLM tooling |
| **Express** | HTTP server, middleware composition, SSE streaming |
| **mysql2** | MySQL connection pool with prepared statements |
| **axios** | HTTP client for DeepSeek API requests |
| **tiktoken** (backend, authoritative) | Accurate server-side token counting before DB writes |
| **rate-limiter-flexible** | Per-IP in-memory rate limiting (swappable to Redis) |
| **tsx** | TypeScript execution in development without a compile step |

> **Why Node over ASP.NET?** The original plan called for ASP.NET Core (C#). During early implementation it became clear that the Node/TypeScript stack offered tighter integration with the LLM tooling (tiktoken, SSE, axios) and kept the codebase in a single language end-to-end. The decision trades the familiarity of .NET for demonstrably faster iteration and a more cohesive portfolio piece.

### Database

- **MySQL 8.0** — ACID-compliant, familiar, strong JSON and full-text support for future features.
- Schema lives in `database/schema.mysql`. Migrations are handled by `database/migrate.cjs` (idempotent, safe to re-run).

### LLM

- **DeepSeek API** (`deepseek-chat` model) — primary. The abstraction lives entirely in `backend/src/services/llm.ts` + `llm.helpers.ts`; swapping to OpenAI or a local model requires changing only those two files and the relevant `.env` vars.

---

## Architecture

```
frontend/  (React SPA, port 3000)
    └── src/
        ├── components/          UI components
        ├── hooks/               useChatLogic, useBottomBar, usePageTransitions
        ├── store/               useGameStore, useUIStore (Zustand)
        ├── styles/              chatLayout.ts (shared layout constants)
        └── utils/api/           typed wrappers for every backend endpoint

backend/   (Express, port 3001)
    └── src/
        ├── config/              env.ts (validated env vars), llm.ts (LLM params)
        ├── db/                  connection.ts (pool), init.ts (schema bootstrap)
        ├── middleware/          passphrase.ts (auth gate), rateLimiter.ts
        ├── prompts/             normalPrompt, cheatPrompt, lossPrompt
        ├── routes/              index.ts, targetWord.ts, chat.ts, leaderboard.ts
        ├── services/            llm.ts (streaming), llm.helpers.ts, chatOrchestrator.ts,
        │                        sessionService.ts, leaderboardService.ts
        └── types.ts             Difficulty, VALID_DIFFICULTIES

database/
    ├── schema.mysql             Full CREATE TABLE definitions
    ├── migrate.sql              Idempotent ALTER TABLE migration script
    └── migrate.cjs              Node runner for migrate.sql

backend/words/
    ├── easy.csv
    ├── normal.csv
    ├── hard.csv
    └── nightmare.csv
```

---

## Security

| Concern | Implementation |
|---|---|
| **Access gate** | Monthly rolling passphrase `{PASSPHRASE_NAME}{Month}{Year}` validated server-side on every protected request via `x-passphrase` header. `PASSPHRASE_NAME` is an env var (default `"Adam"`). |
| **Rate limiting** | `rate-limiter-flexible` — 100 req / 60 s general; 1 000 req / 3 600 s on the reroll endpoint. Swap `RateLimiterMemory` → `RateLimiterRedis` with no other changes when scaling. |
| **API key safety** | `DEEPSEEK_API_KEY` and all secrets live in `backend/.env` (gitignored). `config/env.ts` validates presence at startup and exits immediately if a placeholder value is detected. |
| **SQL injection** | All user-supplied values are bound parameters via `mysql2` prepared statements. The one exception (`OFFSET`) is sanitised to an integer via `Math.trunc()` before inlining. |
| **Input sanitisation** | Target word difficulty is validated against `VALID_DIFFICULTIES` before any DB query. Player name is trimmed and length-capped in the frontend before submission. |
| **Duplicate score prevention** | `score_submitted` boolean on `game_sessions`; a `sessionId` returning `score_submitted = TRUE` receives **409 Conflict** — no second leaderboard row is ever inserted. |

---

## Data Model (key tables)

### `target_words`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK | |
| `word` | VARCHAR(100) UNIQUE | |
| `difficulty` | ENUM('easy','normal','hard','nightmare') | |
| `is_active` | BOOL | Soft-delete support |
| `assignment_count` | INT | Incremented each time the word is assigned to a player |
| `reroll_count` | INT | Incremented when a player rerolls off the word with no messages sent |
| `total_games_played` | INT | Incremented on first message in a session with this word |
| `win_count` | INT | Incremented on a win |
| `avg_tokens_to_win` | DECIMAL(10,2) | Running average |
| `max_tokens_to_win` | INT | |
| `min_tokens_to_win` | INT | |

### `game_sessions`
Stores one row per session. Links messages, target word, difficulty, and score submission state.

### `leaderboard`
| Column | Notes |
|---|---|
| `player_name` | Display name entered on win |
| `token_count` | Authoritative server-side count |
| `target_word` | Snapshot of the word at submission time |
| `difficulty` | ENUM matching `target_words.difficulty` |
| `llm_victory_message` | The full LLM response that contained the target word |
| `completed_at` | Timestamp |
| `session_id` | FK for duplicate guard |

---

## Completed Features

| Feature | Status |
|---|---|
| Passphrase gate (monthly rotating, env-configurable) | ✅ |
| Chat interface with SSE streaming | ✅ |
| Server-side token counting (tiktoken) | ✅ |
| Win detection + animated winning word | ✅ |
| Victory bar → name entry → leaderboard navigation | ✅ |
| Post-win leaderboard highlight scroll | ✅ |
| Session reload win rehydration | ✅ |
| Duplicate score prevention (409 guard) | ✅ |
| Dark / light mode (persisted) | ✅ |
| Horizontal page slide transitions | ✅ |
| Interface state persistence (Zustand persist) | ✅ |
| Difficulty selection dialog (Easy / Normal / Hard / Nightmare) | ✅ |
| Per-difficulty target word fetch | ✅ |
| Word reroll (no-message reset, notifies backend) | ✅ |
| Per-difficulty leaderboard filter tabs | ✅ |
| LLM victory message display in leaderboard entries | ✅ |
| `LeaderboardMessage` — single-line, target word bolded, centered on first mention | ✅ |
| Developer cheat mode (`ENABLE_CHEAT_MODE` + `CHEAT_TRIGGER` env vars) | ✅ |
| Rate limiting (general + reroll buckets) | ✅ |
| Word CSV files (easy, normal, hard, nightmare) | ✅ |
| Seed script (`backend/scripts/seedWords.ts`) | ✅ |
| Database migration script (`database/migrate.cjs`) | ✅ |
| `PASSPHRASE_NAME` env var support | ✅ |
| Validated env-var config (`config/env.ts`) | ✅ |

---

## Remaining Work

### Backend
- **Target word route** — increment `assignment_count` on fetch; add `POST /api/target-word/reroll` endpoint that increments `reroll_count`
- **Leaderboard service** — write `difficulty` + `llm_victory_message` to the DB on `submitEntry`; add `difficulty` query-param filter to `getEntries`; update word win stats (`win_count`, `avg/max/min_tokens_to_win`) on submission
- **chatOrchestrator** — include `llmVictoryMessage` (the full LLM response text) in the `done` SSE event payload when `gameOver = true`
- **sessionService** — increment `total_games_played` on `target_words` when a session's first message is processed

### Frontend
- **ChatPage** — integrate `DifficultyDialog` (component exists, wiring to `ChatPage` pending)
- **useChatLogic** — pass `difficulty` on target-word fetch; capture `llmVictoryMessage` from `done` event; wire reroll API call

### Database
- Run `database/migrate.cjs` on the live DB instance to apply all column additions

---

## Future Directions

| Idea | Notes |
|---|---|
| **LLM provider abstraction** | `llm.ts` is already isolated — adding OpenAI or a local Ollama endpoint is a config change + one adapter |
| **Word stats dashboard** | Use `avg/max/min_tokens_to_win`, `win_rate`, `assignment_count` to surface interesting word difficulty analytics |
| **Hosting** | Frontend → Vercel; Backend → any Node-compatible host (Railway, Fly.io, Azure App Service); DB → PlanetScale or Azure MySQL |
| **CI/CD** | GitHub Actions: `npm run build` + `tsc --noEmit` on PR; deploy on merge to `main` |
| **Redis rate limiter** | Drop-in swap of `RateLimiterMemory` → `RateLimiterRedis` in `rateLimiter.ts` for multi-instance deployments |
| **WebSocket upgrade** | SSE works well for one-directional streaming; a future multiplayer mode might warrant Socket.IO |
| **Accessibility** | ARIA labels on interactive elements, keyboard nav for the difficulty dialog and confirm modals |
| **Mobile polish** | Touch-friendly tap targets, virtual keyboard handling for the chat textarea |
3. **Advanced Security:**
    - Implement Cloudflare Turnstile for passphrase page to block bots.
    - Add audit logging (who won, when, IP) for leaderboard submissions.
4. **Performance Metrics:**
    - Track frontend perf via `react-device-detect` + logs:
        
        ```tsx
        console.log(`Mobile load: ${window.performance.now()}ms`);
        
        ```
        
5. **Open-Source Ready:**
    - Dockerize backend/frontend + detailed `README.md` with architecture diagram.
6. **Bonus Feature:**
    - **"Hall of Shame"** for funniest LLM responses avoiding the target word (stored in DB).

---

### **Implementation Plan**

| **Week** | **Tasks** |
| --- | --- |
| 1 | Project setup, CI/CD, auth gate, MySQL schema. |
| 2 | Frontend: Top ribbon, routing, dark mode. Backend: Passphrase validation. |
| 3 | Chat UI: Bubbles, input box, token counter. |
| 4 | Interface transitions, Zustand state persistence. |
| 5 | Backend: LLM proxy, leaderboard API. EF Core MySQL integration. |
| 6 | Security: Rate limiting, DDoS prep, Cloudflare config. |
| 7 | Testing, mobile polish, deploy to Azure/Vercel. |
| 8 | Bonus features, documentation, video demo. |

---

### **Why This Tech Stack?**

- **.NET + MySQL:** Leverages your strengths while meeting security/scale needs.
- **React + Tailwind:** Showcases modern UI skills with minimalist design.
- **LLM Proxy Pattern:** Highlights understanding of secure API consumption.
- **Cloudflare:** Proactive cybersecurity—critical for portfolios.

**Result:** A performant, secure, portfolio-ready app demonstrating full-stack proficiency in high-demand tools.