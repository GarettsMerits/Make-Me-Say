# Gameplay

*Last reviewed against the source: 25 September 2026.*

## The round

1. The player chooses a difficulty. The server picks a random active row from `target_words` for that difficulty and increments `assignment_count`.
2. The word is shown in the instruction line. The model is not shown to the player as a system prompt; the player only sees the chat.
3. The player sends messages. Each send is one turn: the user text is stored, the model streams a reply, and the server checks that reply for the target word.
4. The player may reroll only before the first message. Reset abandons the round and asks for a difficulty again.
5. A win ends the round. The model then streams a sore-loser reply. The player may submit a name or skip.

The model is told to speak correct English and not to disguise the target word with a misspelling, a homophone, leetspeak, spaced letters, or broken grammar. The detector is still a whole-word match, so a disguise that is not the exact word does not count as a win. Each difficulty can call a different model. The default roster is in [Model roster](Model_Roster.md).

## Win detection

Implemented in `didLlmSayWord` (`backend/src/services/chatOrchestrator.ts`) and again in `containsTargetWord` (`llm.helpers.ts`):

- Case-insensitive.
- Word boundaries (`\b` after regex-escaping the target).
- Applied only to the model reply for that turn, not to the player's text and not to older messages.
- Punctuation around the word still matches (`banana!` matches `banana`). A longer token does not (`banana` does not match `bananas`).

The session row is marked `completed`. Further `POST /api/chat` calls for that session id return 409.

The chat UI's choice of *which bubble to animate* uses a substring test (`String.includes`), not the same word-boundary test. A reload's "was this already a win?" scan uses word boundaries again. Those two checks can disagree; see [Issues](Issues.md).

## Difficulty

Chosen in `DifficultyDialog` and sent as `?difficulty=` on `GET /api/target-word`. If the query is missing or not one of the four names, the route returns a word from any difficulty. The client always sends one after a choice has been made.

Lists live in `backend/words/<difficulty>.csv`, one `word` column, seeded lowercase. Counts below are the data rows in the repository at the time of this review (header excluded; blank lines are not counted as words).

### Easy (~94 words)

Function words and other terms that are hard to avoid in ordinary English: *a, the, to, for, my, you, and, is, of,* and similar. A whole-word match on *a* or *I* (stored as `i`) fires on almost any normal sentence, which is the point of the tier. The model is still prompted never to write the exact word, and not to dodge it with a misspelling, so a careful model can keep the word out of a reply that otherwise answers.

### Normal (~141 words)

Everyday nouns, adjectives, and verbs: *car, sky, food, cool, run, cook, try, pretty, earth, home, green,* and similar.

### Hard (~117 words)

More specific vocabulary the model can route around: *righteous, tactical, destruction, comfortable, asphalt, relief, circuitry, metaphor, poetry, cuisine, doom, melancholy, mollusk,* and similar. The earlier spec's example *sillicone* is a misspelling; check the CSV rather than the old examples before treating a word as present.

### Nightmare (~191 words)

Narrow or uncommon words: *quintessential, defeatist, lordship, trunnion, skirmish, esoteric, brigand, vulpine, amalgamation, abhorrence,* and similar. Older examples such as *quintenssential* and *transcendant* were misspelled in the spec; the seed file is the source of truth.

`target_words.word` is unique across the whole table, not per difficulty. The same spelling cannot be both Normal and Hard.

## Tokens and score

The score is one number: the tiktoken count of the player's own messages, within one difficulty. Ties share a place, because rank is one more than the number of strictly lower scores.

| Number | What it counts | Where it is used |
|---|---|---|
| Draft estimate | Rough player-only estimate, `ceil(trimmed length / 4)` and at least `ceil(word count * 0.75)` | The faded count inside the textarea, and the session total until the turn is saved |
| Player score | `tiktoken` cl100k_base on player messages only | Session total after `done`, victory copy, rank lookup, and the leaderboard row |
| `current_tokens` | Running sum of player and model tiktoken counts | Stored on the session and returned as `totalTokens`. The board does not rank by this |

The composer does not show a predicted place. Rank is fetched when the model actually says the word, and again after a refresh of a finished game, using the player score and the selected difficulty. Until that request returns, the win-flow bar says the place is still being counted, and the highlighted word stays off the medal colours. A failed request says the place could not be loaded.

## What a win records

`POST /api/leaderboard` stores:

| Field | Source |
|---|---|
| Player name | Typed at the win-flow bar, trimmed, at most 32 characters |
| Token count | Sum of the player's stored message counts |
| Target word | `game_sessions.target_word` |
| Difficulty | The word list, then the session column |
| Victory message | The first stored model reply that contains the word as a whole word |
| Completed time | Database default, `CURRENT_TIMESTAMP` |
| Session id | The id the client sends. Required. Unique on the board |

Word statistics on `target_words` are updated in the background after a successful insert: `win_count`, `avg_tokens_to_win`, `max_tokens_to_win`, `min_tokens_to_win`. Nothing in the UI reads them.

`assignment_count` increments when a word is dealt. `reroll_count` increments when the player rerolls before sending. `total_games_played` increments when the first message of a session is inserted, matched by the word string.

## Leaderboard presentation

There is one table and four difficulties, plus an All view that mixes them. Sorting is `token_count ASC, completed_at ASC`. The page requests 100 rows at a time, which is the API cap, and asks for the next page with `offset` when the player chooses Show more. The API defaults to 10 when `limit` is omitted. `offset` is capped at 10 000.

Each entry is meant to show:

```
<rank>  <player name>  <token count>  <date and time>
<target word>  [<difficulty, on the All tab>]
<one-line excerpt of the model message that contained the word>
```

Excerpt rules as implemented in `LeaderboardMessage`:

1. One line, no wrapping (`whitespace-nowrap`, horizontal clip).
2. Every case-insensitive whole-word occurrence of the target is bold.
3. If the line overflows, scroll offset aims to centre the first bold span, clamped so the strip never scrolls into empty space.
4. Overflowing edges fade the text with a CSS mask, so the fade matches the row behind it.
5. If the entire message fits and a match exists, the line is centred. A line with no match stays start-aligned, and the right edge fades when that line overflows.

## Loss acknowledgement

After `gameOver`, the server runs a second streamed completion with `lossPrompt`. The prompt includes the player-only tiktoken sum, a rank within the session's difficulty, and the size of that board. Ties use the same strict-less-than count as the public rank route. The model is told to admit that its own previous reply contained the word, stay PG-13, and otherwise be a sore loser. A failure of this second call does not undo the win. The client still receives `loss-done`.

## Cheat mode

Not a player-facing difficulty. With `ENABLE_CHEAT_MODE=true`, a message containing `CHEAT_TRIGGER` (default `philliburton`) replaces the normal system prompt with one that orders the model to say the target word immediately. Detection is a case-insensitive substring, so the trigger can match inside a longer word.

## Fairness properties the code does enforce

- The browser cannot choose the target string on the first turn. It sends `targetWordId`. The server loads `word` from `target_words` where `is_active` is true.
- Later turns send only `sessionId` and `message`. History and the target word are read from `game_sessions`.
- A completed session cannot accept another turn.
- A score insert locks the session, requires a recorded win, and writes the server's own count, word, difficulty, and quote.
- `leaderboard.session_id` is unique, so a second insert for the same session is 409.
- Reset marks an unfinished session complete, so that session cannot take another turn.

Two overlapping turns for the same session can still both read the old transcript. The last write wins. That gap is in [Issues](Issues.md).
