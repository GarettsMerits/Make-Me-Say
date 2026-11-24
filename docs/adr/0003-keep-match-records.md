# Match records stay when space runs out

A decline keeps the conversation, and a leaderboard entry keeps the reply that earned it. The database size limit is a last resort, expected to stay unused at the scale of this game.

## Considered options

- Delete the oldest sessions, including declined rounds and leaderboard rounds. Rejected because a decline must leave a record, and an entry must keep the reply it shows.
- Delete nothing once the limit is hit. Rejected because a full disk would stop new games.

## Consequences

Pruning removes only ended rounds that were not declined and have no leaderboard entry. If the database is still over the limit, conversations attached to leaderboard rounds are reduced to the featured reply. Leaderboard rows themselves are not deleted. A round that can still be committed is left alone.
