# Gameplay

When starting their first game or starting a new game (not just rerolling a word), the user is prompted in a dialogue to select a difficulty from a list of radio buttons. 

## Difficulty

### Easy

Easy difficulty has simple words that the LLM will have a difficult time omitting or circumventing due to their necessity in the English language.

These include, but are not limited to, "a", "the", "to", "for", "my", "you", "I", "and", "is", "of", etc.

### Normal

Normal difficulty has an extensive list of very common nouns, adjective, and verbs. 

E.g. "car", "sky", "food", "cool", "run", "cook", "try", "pretty", "Earth", "home", "green", "one", "bug", etc.

### Hard

Hard difficulty contains an extensive list more specific, less commonly used words that the LLM can more easily avoid stating.

E.g. "righteous", "tactical", "destruction", "comfortable", "asphalt", "relief", "circuitry", "metaphor", "poetry", "cuisine", "doom", "protrusion", "melancholy", "mollusk", "sillicone", "flood", etc.

### Nightmare

Nightmare difficulty contains an extensive list of highly specific, challenging, and uncommonly used words that will be very difficult to make the LLM say.

E.g. "quintenssential", "defeatist", "lordship", "trunnion", "skirmish", "esoteric", "brigand", "vulpine", "arithmetic", "amalgamation", "abhorrence", "deceased", "transcendant", etc.


## Leaderboards

There will exist a different leaderboard for each difficulty level. 

The difficulty can be selected at the top of the leaderboard.

A winning entry should record the following in the database:

* The player's entered name
* The date and time at the moment of the victory
* The target word assigned
* The player input token count used to win
* The LLM's message that contained the target word, resulting in the player's victory

An entry on the leaderboard should be represented the following information:

-

`<Leaderboard Rank> <Player Name> <player input token count> <victory date and time>`

<LLM's target word message>

-

The LLM's target word message will require formatting to fit within the entry in an appealing manner. It should abide the following rules:

1. The message excerpt must be contained to a single line in the leaderboard entry.
2. Target word mention(s) should be bold.
3. In the probable event that the LLM's message containing the target word is too big to fit in the leaderboard entry on a single line, the first mention of the target word should be centered in the available text space, with the preluding and trailing text flanking it. If there isn't enough trailing text in the message for the target word to be centered without wasting space to the right side of the first mention of the target word, the text should be right-justified, ensuring as much preluding texts appears in the excerpt as possible. Vice versa in the event that there isn't enough text preluding the first mention of the target word available. If there is enough room to encasulate the entire message in the excerpt text area, the entire excerpt should be centered in the text area.
4. When there is enough text in the excerpt that it would overrun its boundaries, it's opacity should fade in/out using a gradient on the side(s) that would overrun it's boundaries.

## Word Collection

I've compiled comprehensive word lists for each difficulty tier, stored as CSV files under `backend/words/` and ordered alphabetically. A seed script (`backend/scripts/seedWords.ts`) reads these files and populates the `target_words` table, assigning each word its difficulty. The seed is idempotent — it can be re-run safely at any time.

The database records and computes the following per-word statistics:

* Number of times players have won with the word
* Number of times the word has been assigned to a player
* Number of times a player has rerolled off the word (no messages sent before rerolling)
* Total games played with the word (at least one message sent after being assigned it)
* Average player input tokens required to win with the word
* Most tokens a player has ever needed to win with the word
* Fewest tokens a player has ever needed to win with the word
