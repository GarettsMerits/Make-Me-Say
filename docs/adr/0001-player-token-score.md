# Score only the player's messages

The score measures what the player spent to make the model say the target word. It counts tokens in the player's messages only, and it locks when the model uses that word as a whole word in its own reply. A figure shown while the player is still typing is not the score.

## Considered options

- Counting the model's replies as well. Rejected because that measures the model's verbosity rather than the player's effort.
- Treating a substring as a win. Rejected because a word such as "category" would win for "cat".

## Consequences

A leaderboard entry stores the locked score from the player's messages, not the preview shown while typing.
