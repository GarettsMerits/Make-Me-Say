# ‘Don’t Make Me Say’

Don’t Make Me Say is a web development portfolio project designed to showcase a strong and well-rounded web development skillset combined with in-demand AI and cybersecurity knowledge for use in my professional portfolio.

Don’t Make Me Say is a game within a website that will use an orthodox user-to-LLM chat interface where the user is challenged with making the LLM say a specific A.K.A. ‘target’ word displayed above the chat interface. To add challenge, the LLM will be prompted against using the target word in its response. If the user does succeed in making the LLM use target word in its response, the user wins.

There will also be a leaderboard scoring the user’s performance based on the number of input tokens that were required to make the LLM say the target word. If a player wins, a congratulatory prompt will ask the player for their name, which will then be added alongside their score on the leaderboard page.

## Overall Structure

- Top Ribbon
  - A omni-present ribbon at the top of the page. Contains clickable buttons to change light/dark modes, logout, and swap between Chat, How To Play, Leaderboard, and About interfaces. The current interface selected will be highlighted.
    For example, If I was currently in the Leaderboard interface, the Top Ribbon might look like this [ Chat | How To Play | >Leaderboard< | About ]
  - This module is anchored to the top of the viewport.
- Chat Interface
  - Center justified and limited to a comfortable reading width. Dynamically downsize width if viewport width shrinks below intended interface width to eliminate horizontal scrolling.
  - User Instruction Prompt
    - A small enlarged blurb saying “Don’t make me say [target word]”.
    - Anchored to the underside of the Top Ribbon.
  - Chat Messages Interface
    - Dynamically sizes vertically to fill viewport space between Message Input Box and User Instruction Prompt
    - ‘Bubbled’ chat messages with different colours for LLM and user.
    - LLM responses left-justified, user messages right-justified with their right edge aligned to the send/reset control column for visual symmetry.
    - Scrollable chat that fades at the top before it would overlap the user instruction blurb and fades at the bottom before it would overlap the message input box
    - Token counter that dynamically counts the total user-input message tokens and potential best leaderboard position should the user win after submitting only one more token. Located beneath the message input box.
  - Message Input Box
    - A text input field for writing messages to the LLM.
    - Reset/retry and submit buttons are vertically stacked on the right edge of the input area (reset above submit) to minimize horizontal travel and keep controls grouped.
    - Token counter that dynamically counts the tokens contained within the text in the message input box. Located within the text input field at the bottom, left-justified, smaller, faded text.
    - This module is anchored to the bottom of the viewport.
- Win Sequence
  - When the LLM's response contains the target word, the win sequence activates:
  - **Animated target word in chat:** The matching word inside the winning LLM message bubble is rendered in bold. Each letter rises and falls in a continuous left-to-right wave animation (Framer Motion staggered `y` keyframes). A periodic shiny reflective streak sweeps across the word in sync with the wave. The word is coloured by rank: gold for 1st, silver for 2nd, bronze for 3rd, white otherwise.
  - **User Instruction Prompt changes:** The "I dare you to make me say…" prompt transitions to "Dangit! I said '[target word]'" with an animated crossfade.
  - **Victory Bar replaces the Message Input Box** at the bottom of the chat. It has three sequential states:
    1. *Victory prompt* — Congratulates the player, shows total tokens used and the leaderboard rank they achieved. Two buttons: "Submit my score" and "No thanks". The bar expands vertically to accommodate the content.
    2. *Username entry* — A single-line text input with score and rank visible. Player types their desired display name and confirms. Name is validated (non-empty, ≤ 32 characters) before submission.
    3. *Declined / disabled* — If the player opts out, the bar reverts to the standard input layout but with the textarea and submit button permanently disabled. The reset button remains active; the player must hit Reset to start a new game.
  - **Post-submission leaderboard navigation:** After a successful score submission the app automatically navigates to the Leaderboard page and smoothly scrolls the player's newly submitted row into the centre of the panel. That row is highlighted by one brightness layer (a ring + background tint that respects light/dark mode) for 3 seconds before clearing.
  - **Session reload win rehydration:** `isWon` and `wonRank` are intentionally excluded from Zustand's persisted state (they are transient UI state, not game data). On every page load they reset to `false`/`null`. A mount-only `useEffect` in `useChatLogic` therefore scans the persisted `messages` array on startup: if any LLM message contains the target word as a whole word, `isWon` is set to `true` and `wonRank` is fetched from the leaderboard rank endpoint. This ensures that if a player wins and then reloads the page before resetting, they are correctly returned to the Victory Bar state rather than being shown the normal input bar.

## Server-Side Score Submission Integrity

To prevent a player from submitting their score more than once for a single winning session (e.g. by reloading the page after already recording their score), a `score_submitted` boolean column (`NOT NULL DEFAULT FALSE`) is maintained on the `game_sessions` table.

### Flow

1. When `POST /api/leaderboard` is called with a `sessionId`, the server queries `game_sessions` for that session's `score_submitted` flag.
2. If `score_submitted = TRUE`, the server immediately returns **409 Conflict** with `{ error: 'Score already submitted for this session' }`. No leaderboard row is inserted.
3. If `score_submitted = FALSE` (or no session found), the leaderboard row is inserted normally.
4. After a successful insert, the server executes `UPDATE game_sessions SET score_submitted = TRUE WHERE id = ?` to mark the session as scored.

If no `sessionId` is provided in the request body, the duplicate-check is skipped (legacy / anonymous submissions are allowed through without a guard).

## LLM System Prompts

Each chat turn injects a system prompt into the DeepSeek request to control LLM behaviour. Prompts live in dedicated files under `backend/src/prompts/` so they can be tweaked freely without touching route or service logic:

| File                                                             | Used when                                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prompts/normalPrompt.ts` → `buildNormalPrompt(targetWord)` | Every normal game turn — instructs the LLM to**never** say the target word.                          |
| `prompts/cheatPrompt.ts` → `buildCheatPrompt(targetWord)`   | Developer cheat mode only — instructs the LLM to say the target word**immediately and prominently**. |

`llm.ts` imports both builders and selects between them based on the `cheatMode` boolean passed from the chat route.

## Developer Cheat Mode

A dev-only shortcut that lets me force an instant win without having to outsmart the LLM. It is entirely controlled by two `.env` variables in `backend/.env`:

```
ENABLE_CHEAT_MODE=true     # set to false (or remove) to disable entirely
CHEAT_TRIGGER=philliburton # the magic word the player types in any message
```

### How it works

1. `chat.ts` reads `ENABLE_CHEAT_MODE` and `CHEAT_TRIGGER` once at module load.
2. If `ENABLE_CHEAT_MODE=true`, each incoming message is checked for the trigger word (case-insensitive substring match).
3. When detected, `cheatMode: true` is passed to `streamChatCompletion`, which substitutes `buildCheatPrompt` for `buildNormalPrompt`.
4. The cheat prompt orders the LLM to say the target word immediately, guaranteeing `gameOver = true` in the `done` SSE event.
5. A warning is printed to the backend console on startup when cheat mode is active: `[dev] Cheat mode ENABLED — trigger word: "philliburton"`.

> **Never enable in production.** Set `ENABLE_CHEAT_MODE=false` or omit the variable entirely before deploying.

## Shared UI — Confirm Dialog

A reusable `ConfirmDialog` component (`src/components/ConfirmDialog.tsx`) provides a consistent modal confirmation experience across the entire application.

### Behaviour

- Rendered as a **direct child of the `ChatPage` root container** (not inside the sticky bar), so the overlay covers the **full chat area** (messages + bars) while leaving the Top Ribbon unaffected.
- A full-section `backdrop-blur-sm` overlay covers the host section. In light mode the tint darkens the content behind; in dark mode it lightens it. This draws the user's eye to the dialog without obscuring the rest of the page.
- A centered card (matching the visual language of the PassphraseGate login card) animates in with a subtle scale + fade entrance and exits the same way.
- Clicking the backdrop or pressing **Escape** cancels the dialog.
- Props: `message`, optional `detail` (secondary muted line), `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`.

### Current usages

| Location                                       | Trigger                         | Confirm action                                                  |
| ---------------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| **ChatPage** (victory — prompt state)   | Player presses "No, thanks."    | Transition VictoryBar to `'declined'` state (score not saved) |
| **ChatPage** (victory — declined state) | Player presses the Reset button | Clear session and fetch new word                                |
| **ChatPage** (normal input bar)          | Player presses the Reset button | Clear session and fetch new word                                |

> **Architecture note:** `VictoryBar` no longer owns any `ConfirmDialog` renders. Instead it calls `onRequestDeclineConfirm(cb)` or `onRequestResetConfirm(cb)` and passes the action as a callback. `ChatPage` stores the pending callback in `pendingConfirm` state and renders the appropriate dialog at root level, ensuring the overlay correctly escapes the sticky `.bar-bottom` stacking context.

### Adding a new usage

Wrap the host section in a `relative` container, maintain a boolean state variable, and render `<ConfirmDialog>` conditionally inside that container:

```tsx
<div className="relative">
  <YourSection />
  {dialogOpen && (
    <ConfirmDialog
      message="Are you sure?"
      confirmLabel="Yes"
      cancelLabel="No"
      onConfirm={handleConfirm}
      onCancel={() => setDialogOpen(false)}
    />
  )}
</div>
```

- Leaderboard Interface
  - Center justified and limited to a comfortable reading width.
  - Scrollable table containing winning user's names and token scores from lowest to highest
- About Interface
  - An about page describing the creator, and tech stack used.
- How To Play Interface
  - A page that describes how the game works and how to play it.

## Tech Stack

My tech stack requirements were:

- Optimal fit for the project's requirements.
- Performant, maintainable, and high security.
- Current widespread industry adoption or highly-probable future widespread industry adoption.
- Demonstrates in-demand professional developer skills.
- DeepSeek API is my chosen LLM, with accommodations built in for other APIs including homebrew LLMs running off my own server.

I was initially partial to .NET and MySQL given my familiarity with them, but I was open to learning a new language if better or more in-demand tools existed for this project.

## Other Features

### Security

The site should be protected from DDoS attacks and bot activity.

Additionally, access requires having to enter a simple rolling passphrase before the site loads. This is to reduce access to people who haven’t been given explicit access. For example, the rolling passphrase will be [my name][current month][current year], e.g. “AdamAugust2025”.

No information about what the site is or how it works should be observable in any way before successfully entering the passphrase.

### Dark/Light Mode

There will be a toggle in the top left corner for light mode and dark mode, this will affect all elements on the entire site without requiring a reload. The site will initially load in light mode.

### Lightweight Mobile Compatibility

The web page should be easily used and accessed on a wide variety of devices including smartphones while maintaining readability and usability. Page elements will resize to eliminate any potential horizontal scrolling.

### Maximal Browser Compatibility

This project should be designed to maximize its compatibility will all modern commonly adopted web browsers.

### Minimalist UI

UI should be kept as simple as possible to reduce device load and simplify user experience.

### Smooth Interface Transitions

When navigating between the chat, leaderboard, and about interfaces, transition between them by sliding them horizontally into/out of frame smoothly.

For example, if I were in the Leaderboard interface, and I clicked Chat on the top Ribbon, the Leaderboard interface elements would slide offscreen to the right, and the Chat interface would slide in from offscreen from the left.

### Interface Persistence

If the user changes between interfaces, the state of that interface persists so that when they navigate back to an interface they were previously on, its state hasn’t been reset. This is primarily used to maintain the state of the chat when going to and from the leaderboard and chat interface.

## What’s Required?

- An overview of the determined tech stack and how it links together.
- Suggested project workflow.
- A development, testing, and implementation plan.
- Any other expert suggestions by you to enhance the impression of this project by potential employers.
