# Overview

*Last reviewed against the source: 26 September 2026.*

Don't Make Me Say is a portfolio web game. The player sees one word and a normal chat box. The model on the other side of the chat has been instructed never to say that word. If it does, the player wins. A lower token count is a better score, and the player may put a name on the leaderboard.

The original brief asked for a minimalist, mobile-usable, light-and-dark interface, a passphrase so the site is not public, and horizontal transitions between Chat, How To Play, Leaderboard, and About. This document describes the product as it behaves now. Where an earlier spec described something that was not built, or was built differently, that is called out here. Defects are catalogued in [Issues](Issues.md).

---

## What the player experiences

### Before the passphrase

`PassphraseGate` is the only screen. It is a single password field and a submit button on a plain card. There is no title, rules, or explanation of the game. Dark mode still applies if a previous visit stored `isDarkMode` in `localStorage`, because the UI store is read before login.

Submit calls `POST /api/auth/verify`. On success the server sets an HttpOnly cookie. The page stores only a boolean `authenticated` flag in `sessionStorage` so the gate can skip itself. A refresh calls `GET /api/auth/me` and returns to the gate if the cookie is gone. Logout calls `POST /api/auth/logout` and clears the flag. The passphrase is not kept in the page.

A wrong passphrase shows "Invalid passphrase". Network failures show the thrown error text.

### After the passphrase

`MainApplication` renders a fixed top ribbon and one page. The ribbon is 64px tall (`h-16`), full width, above the page content (`z-50`).

| Control | Behavior |
|---|---|
| Title "Don't Make Me Say" | Visible from the `lg` breakpoint up, absolutely at the left. Hidden on smaller widths so the tabs fit. |
| Chat, How To Play, Leaderboard, About | Sets `currentPage`. The active tab is highlighted. Order is also the slide order. |
| Theme | Toggles `isDarkMode`. The `dark` class is applied to `<html>` and to the app shell. No reload. Default for a first visit is light mode. |
| Logout | Clears the access cookie and returns to the gate. Game state in `localStorage` is not wiped. |

Moving to a page later in that order slides the old page off to the left and the new page in from the right. Moving earlier does the reverse. The animation is a 300ms tween. Inactive pages unmount (`AnimatePresence` `mode="wait"`), so local React state on a page is discarded. Anything that must survive lives in Zustand.

A first visit with empty `localStorage` opens on How To Play (`currentPage` defaults to `howtoplay`). The `hasSeenGame` flag does **not** navigate anywhere. It only changes what the difficulty dialog does the first time the player confirms it.

---

## Chat

The chat page is a column that fills the area under the ribbon: instruction line, message scroller, bottom bar. Width is capped at Tailwind `max-w-4xl` and padded so narrow viewports shrink instead of scrolling sideways.

### Difficulty dialog

Shown when `difficulty` is null (first game, or a session that was reset) and again when the player presses reset. It cannot be dismissed with Escape or a backdrop click. The player picks one of four radio options and confirms.

- First confirm in a browser (`hasSeenGame` still false): stores the difficulty and loads a word. The player stays on Chat.
- Later confirms: `resetSession()` clears the conversation, then the chosen difficulty is applied and a new word is fetched.

The dialog is positioned over the chat column only. The ribbon stays usable, so the player can leave Chat without choosing.

### Instruction line

While the game is in progress the line reads: **I dare you to make me say "…"**, with the word in red. After a win it crossfades to **Dangit! I said "…"**, with the word in green.

During a reroll the store's `targetWord` is briefly empty. The component keeps the last non-empty word on screen (or the literal `banana` if a word has never loaded) so the line does not flash blank.

### Messages

- Player bubbles are blue, on the right, with a token estimate under the text.
- Model bubbles are on the left, on the layer-3 surface, and can use the full column.
- Both columns share a grid with a 56px side track so the bubble edges line up with the composer and the reset/send buttons.
- The list grows upward from the bottom of the scroller and smooth-scrolls to the newest message.
- A 48px gradient fades the top of the list into the page background. There is no matching fade above the composer.
- Scrollbars are hidden, not removed: the area still scrolls.
- While the model is streaming, a typing indicator shows until the first character of the current reply arrives. An empty placeholder bubble is in the store during that gap and is not rendered.

### Empty chat and reroll

If there are no messages, the scroller is a large repeat icon, "Click to reroll your target word", and a "Start chatting to begin" line. The icon is nearly invisible (9% opacity) until hover. Clicking it is allowed only when the message list is empty. The client tells `POST /api/target-word/reroll` which word was abandoned, clears the session, keeps the current difficulty, and lets the load effect fetch a replacement. The button is disabled while that fetch is in flight.

Reset (the 🔄 button) is a different action: it opens the difficulty dialog even after messages exist. It does not call the reroll endpoint. It does not ask for a separate confirmation.

### Composer

Anchored at the bottom. The inner box is at least 180px (`BAR_BOTTOM`) so the message area does not jump when the victory UI replaces the composer. Extra content can make the bar taller.

- Session total on the left: the server's player-only count after each saved turn. Until that event, it includes the local estimate for the message just sent.
- Textarea, 120px tall, three rows, not user-resizable. Enter sends. Shift+Enter inserts a newline. The field clears as soon as a send is accepted locally, before the model finishes. A rejected turn puts the draft back.
- A small faded token estimate sits inside the textarea at the bottom left.
- Reset above Send, in a 56px column. Reset is disabled only while a reply is in flight. Send is disabled while a reply is in flight, after a submitted win (`isGameOver`), or when the draft is empty.
- An error string from the last failed load or turn is a red banner under the instruction line.

### Win

The server decides the win. A reply wins when it matches the target as a case-insensitive whole word (`\b`). The browser then:

1. Replaces the session total and the last player bubble with the server's player-only counts.
2. Appends an empty bubble that will be filled by the model's loss acknowledgement (a second streamed reply).
3. Asks `GET /api/leaderboard/rank/:tokenCount?difficulty=` for a rank, using that player-only count and the selected difficulty. If the request fails, the UI still marks a win and leaves the rank empty.
4. Sets `isWon` from the server. The instruction line switches. The winning bubble is the reply the server named, not a later message that repeats the word.

`WinningWord` renders each letter of each match in that bubble:

- Gold, silver, or bronze for ranks 1–3. Other ranks use the normal bubble text colour.
- Letters rise and fall 6px in a left-to-right wave.
- The colour flashes toward white (or blue, off the podium, in light mode). Rank 1 flashes three times per cycle, rank 2 twice, everyone else once.

The loss acknowledgement is a separate model call. The prompt tells it the rank and the player token count. That second message often repeats the forbidden word. The highlight stays on the reply the server named, so it does not jump onto the tantrum.

### Win-flow bar

Shown when `isWon` is true and `scoreSubmitted` is false. The sub-state is stored with the game, so leaving the page or reloading keeps prompt, name entry, or declined.

1. **Prompt** — "You won!", the player token total, and the rank from the lookup above. "Submit my score!" or "No, thanks."
2. **Name** — Recap line, a single-line name (required, at most 32 characters), confirm (✓) and back (✕). Enter confirms.
3. **Declined** — Copy says to hit Reset. The textarea and send control are inert. Reset opens the difficulty dialog.

"No, thanks" opens `ConfirmDialog` over the chat column (not over the ribbon): "Skip score submission?" Escape, the backdrop, or "Go back" cancels. "Skip" moves to the declined state. Backdrop clicks are ignored for 350ms so the click that opened the dialog cannot close it.

Confirming a name calls `POST /api/leaderboard` with the display name and the session id. The server returns the token count and rank it stored. On success `scoreSubmitted` is set, the session total becomes that count, `pendingHighlightId` is set to the new row id, and the app switches to the Leaderboard page. HTTP 409 ("already submitted") is treated as success without a highlight. Any other error stays on the name field. A missing session id does not post.

After a successful submit, returning to Chat shows the normal composer with the textarea and send button disabled (`isGameOver`). Reset still works. Reset of a game that has a session id also asks the server to mark that unfinished session complete.

A reload restores the win the server already locked. It does not scan the transcript to decide a win. The win-flow bar returns, and the rank is fetched again if it was not already stored. A submitted game stays on the locked composer.

---

## How To Play

A single scrolling card: the challenge, a four-step flow, the "fewer tokens rank higher" rule, four strategy examples (association, riddles, storytelling, role play), and short interface tips. It does not mention difficulty, reroll, or the loss acknowledgement. The on-screen instruction quote in this page now matches the chat ("I dare you to make me say").

---

## Leaderboard

A scrolling page, same max width as chat.

- Header card explaining that fewer tokens rank higher.
- Pill tabs: All, Easy, Normal, Hard, Nightmare. The selection is stored with the other interface preferences, so leaving the page keeps it.
- Four stat tiles from `GET /api/leaderboard/stats`: games played, average tokens, best (minimum) score, worst (maximum) score. The request includes the selected difficulty, and All omits it.
- Top scores from `GET /api/leaderboard?limit=100`, filtered when a difficulty tab is selected. Rank on screen is the row index in that response, not a rank stored in the database. Medals for the first three rows.
- Each row shows name, the target word in quotes, the difficulty label when All is selected, the token count, and on `sm` and up the date and time.
- If `llm_victory_message` is present, `LeaderboardMessage` shows it on one line. Whole-word occurrences of the target are bold. If the line is wider than the row, it is scrolled so the first occurrence sits in the centre when there is room on both sides, and a mask fades the clipped edges. When the whole message fits, a line that contains the word is centred.

When `pendingHighlightId` matches a loaded row, that row is scrolled to the centre and given a blue ring for 3 seconds. If it is not on the first page, the page keeps requesting the next 100 rows until the row appears, ten extra pages have been loaded, or the board ends. Show more does the same request when the player asks.

Empty and error states share the same empty-state component. Loading is five pulsing bars.

---

## About

A short card: frontend stack (React, TypeScript, Tailwind, Framer Motion, Zustand) and backend stack (Node.js, Express, TypeScript, MySQL, server-side model calls), plus a feature list. An earlier version of this page named ASP.NET Core and Entity Framework. That stack was the original plan and is not what runs.

---

## Persistence

| Data | Where | Survives refresh | Survives leaving the page |
|---|---|---|---|
| Signed-in flag | `sessionStorage` key `authenticated` | Yes, same tab. The cookie is what the API trusts | Yes |
| Dark mode, current page, `hasSeenGame`, highlight id | `localStorage` key `ui-preferences` | Yes | Yes |
| Messages, session tokens, target word and id, difficulty, session id, victory sub-state, `scoreSubmitted`, composer draft, victory-bar name | `localStorage` key `game-session` | Yes | Yes (store is global) |
| `isWon`, `wonRank`, `victoryMessage`, loading flag | Memory only | A win is reconstructed from messages; rank is refetched | Kept until a full reload |
| Leaderboard difficulty tab | `localStorage` key `ui-preferences` | Yes | Yes |

---

## Visual system

Tailwind `darkMode: 'class'`. Neutrals are pure grey (the default Tailwind blue-tinted greys are overridden). Surfaces use a five-step `layer` scale:

- Light mode runs from `#CCCCCC` (layer 1, page) up to white (layer 5).
- Dark mode runs from black (layer 1) to `#333333` (layer 5).

Shared component classes in `frontend/src/index.css`: `card`, `card-inner`, `bar-top`, `bar-bottom`, `app-heading`, `app-body`, `app-muted`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `app-textarea`. Primary actions are blue-600. Reset and secondary actions are grey.

Body type is the system UI stack. The layout goal is a comfortable reading column, no horizontal page scroll, and no layout shift between playing and the win-flow bar.

---

## What this product is not

- It is not account-based. Anyone with the monthly passphrase shares one anonymous gate.
- It is not multiplayer and it does not use WebSockets. One browser, one session id, one model stream.
- It does not show word statistics, even though the database stores them.
- It does not route by URL. Refreshing always remounts the last `currentPage`, not a path like `/leaderboard`.
- React Router is a dependency and is unused by the page switcher.
