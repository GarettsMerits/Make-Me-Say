# Development and implementation plan

*Last reviewed against the source: 26 September 2026.*

This file used to mix three eras: the original .NET proposal, a week-by-week plan, and a "remaining work" list that described features already present in the tree. Those are separated below. Behavior and schema detail live in [Overview](Overview.md), [Gameplay](Gameplay.md), and [Architecture](Architecture.md). Defects live in [Issues](Issues.md).

---

## Stack that shipped

| Layer | Choice | Why it stayed |
|---|---|---|
| UI | React 19, TypeScript, Tailwind, Framer Motion, Zustand | One language with the server, small global store, utility CSS, animation for slides and the win |
| Server | Node.js, Express, TypeScript | Same language, straightforward SSE, `tiktoken` and `axios` already target Node |
| Data | MySQL 8 via `mysql2` | The database that was already chosen. Access is SQL in the service files, not an ORM |
| Model | DeepSeek `deepseek-chat` over HTTPS, streaming | Called only from `services/llm.ts`. Vendor-specific settings are `config/llm.ts` plus the three prompt files |

The first plan was ASP.NET Core, Entity Framework, and a React front end, with Cloudflare in front. Node replaced .NET during implementation so the LLM client, token counter, and UI could share TypeScript. Entity Framework was never added. Cloudflare was never added. The About page previously repeated the .NET stack; it now matches this table.

Create React App (`react-scripts` 5) still builds the front end. React Router DOM is installed and unused. The live draft estimate is a character ratio. `tiktoken` runs only on the server.

---

## What is built

| Area | Status |
|---|---|
| Monthly passphrase exchanged for an HttpOnly cookie | Built |
| Chat UI, SSE streaming, server-owned history and target word | Built |
| Whole-word win detection, animated word, win-flow bar, name entry | Built |
| Decline confirmation, then a locked composer until reset | Built |
| Score post from the locked session, one row per session id | Built |
| Jump to the leaderboard and highlight the new row, loading further pages until it appears | Built |
| Reconstruct a win from saved messages after refresh, without clearing a submitted score | Built |
| Dark / light mode, persisted | Built |
| Horizontal page slides | Built |
| Chat transcript, victory sub-state, composer draft, victory-bar name, and leaderboard tab persisted | Built |
| Difficulty dialog, per-difficulty word fetch, per-difficulty leaderboard tabs and stats | Built |
| Reroll before the first message, with `reroll_count` | Built. An unknown id is 404 |
| `assignment_count` on deal, `total_games_played` on first message | Built. The games-played update shares the session insert's transaction |
| Reset closes an unfinished server session | Built |
| Victory excerpt, whole-word bold, edge mask, centring when the line fits | Built |
| Word stat columns updated on submit, average using the previous win count | Built. No screen reads them |
| Cheat mode env flag | Built |
| In-memory rate limits, including a tighter cap on passphrase attempts | Built |
| CSV word lists and `npx tsx scripts/seedWords.ts` | Built. A duplicate spelling keeps its existing difficulty |
| Schema file applied on startup for missing tables | Built |
| Env validation for a model key | Built. OpenRouter is preferred. Direct DeepSeek is the fallback |
| GitHub Actions workflow file | Present. Both test suites run. Deploy steps do not deploy. The front-end audit is reported and does not fail the job |

---

## What is not built

These were either on the original plan, described as done in an older revision of this file, or implied by columns and comments that nothing calls.

- Word-stat dashboard.
- Writes to `api_usage`.
- Routing first-time visitors to How To Play via `hasSeenGame` (the flag only changes the difficulty dialog's copy path). A fresh visit already opens there.
- A live rank preview in the composer. The old placeholder was removed rather than wired to a request on every keystroke.
- More than one API process, WebSockets, account login.
- Cloudflare or any other edge proxy. Production deploy automation.
- An integration test that boots the API. Accessibility pass beyond the labels already present.
- Token counting that follows the selected model's own encoding. Counts stay on the gpt-4 encoding.

---

## Suggested workflow from here

1. Restart the API after pulling this build, then sign in again. Set `OPENROUTER_API_KEY` before expecting the per-difficulty roster. Rows posted by the old client are not rewritten.
2. Decide whether the deploy jobs should stay, and whether the Create React App audit failure should stop the workflow.
3. A word-stat view or a second model provider can sit on the score the server now records. Neither is required for the board to mean what it says.

---

## Original eight-week plan

Kept as history. It is not a description of remaining calendar work, and it still names tools that were dropped.

| Week | Planned tasks | What actually happened |
|---|---|---|
| 1 | Project setup, CI, auth gate, MySQL schema | Repo, schema, and passphrase exist. CI is a non-deploying workflow with a failing frontend test |
| 2 | Ribbon, routing, dark mode, passphrase | Ribbon, store-driven pages, dark mode, and passphrase exist. URL routing does not |
| 3 | Bubbles, composer, token counter | Built. The counter the player sees is an estimate |
| 4 | Transitions, persisted state | Built for the transcript and theme. Not for every widget |
| 5 | LLM proxy, leaderboard API, EF Core | LLM proxy and leaderboard API exist. EF Core does not |
| 6 | Rate limiting, DDoS preparation, Cloudflare | In-memory rate limit only |
| 7 | Testing, mobile polish, Azure / Vercel | Layout is responsive. There is no deployment and no real test suite |
| 8 | Bonus features, documentation, video demo | Difficulty, reroll, win animation, and this documentation pass. No video demo in the repo |

---

## Why the stack changed

.NET and MySQL were the familiar starting point, and they would have been a credible portfolio stack. The implementation moved to Node because `tiktoken`, streaming HTTP, and the React client were all TypeScript, and a second language was costing more than it was showing. MySQL stayed. The security story that remains visible to a reviewer is: the model key never reaches the browser, the secret word is not client-authoritative, queries are parameterized, and a passphrase plus a rate limit sit in front of an expensive upstream call. The story that does not hold up yet is leaderboard integrity and production hardening. Those are written as findings, not as completed work.
