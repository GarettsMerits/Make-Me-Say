# Don't Make Me Say

A game in which a player tries to make a model say a target word.

## Visit

**Player**:
A person playing the game.
_Avoid_: User

**Passphrase**:
The shared monthly secret that signs a player in. There is no player account. When it changes, the player signs in again, and that sign-in does not start a new session.
_Avoid_: Password, account, login

**Session**:
A player's activity from sign-in until sign-out, holding at most one deal or open round. Sign-out suspends whatever is open, and sign-in on the same browser resumes it. A different browser is a different session.
_Avoid_: Round, fingerprint

## Match

**Difficulty**:
One of four tiers — easy, normal, hard, or nightmare — chosen before a deal and kept for the round that follows.
_Avoid_: Level

**Target word**:
The word the model must not say. The player can see it.
_Avoid_: Secret, keyword

**Deal**:
A target word held at a chosen difficulty before the first message. It can be rerolled. The first message starts a round on it. Reset before that discards it.
_Avoid_: Assignment

**Reroll**:
A replacement of a deal's target word before the round starts. The difficulty stays.
_Avoid_: Shuffle

**Model**:
The opponent in the chat, told not to say the target word.
_Avoid_: LLM, assistant, bot

**Round**:
A match with the model on one deal. It starts when the player sends the first message and ends when the player resets. A win does not end it. It belongs to the session that started it, and only that browser can resume it.
_Avoid_: Session, game

**Reset**:
The act that ends a round, or discards a deal when no round has started. It does nothing while the model is still replying, and that reply can still win.
_Avoid_: Logout, sign-out

## Result

**Token**:
The unit of a score, taken from the text of a player's message.
_Avoid_: Character, word

**Token preview**:
The estimate of a round's score while the player can still send, including the unsent draft when there is one. It is not the score.
_Avoid_: Score, session total

**Score**:
The tokens in the player's messages during one round, locked at the win. Nothing after the win changes it. While the player can still send, the figure shown is the token preview; from the win onward, the figure shown is the score.
_Avoid_: Session total, potential position

**Win**:
The model's first use of the target word as a whole word in its own reply during a round. The player's text cannot win, and a longer word that merely contains the target does not count. That win finalizes the score and opens the win flow; a later reply cannot win again or change the score.
_Avoid_: Game over, completion

**Win flow**:
The part of a round after a win and before reset. The player cannot send messages. Before they commit or decline, the provisional place is shown. After either choice the round can be read and reset, and nothing else. A decline hides the provisional place. A commit shows the entry's current rank.
_Avoid_: Game over

**Win-flow bar**:
The controls along the bottom of the chat during the win flow. The player uses them to commit or decline.
_Avoid_: Victory bar

**Decline**:
The player's final choice during the win flow not to commit the score. No leaderboard entry is created, and the score cannot be committed later. The round, including its conversation, remains. The player can read it, and reset still ends it.
_Avoid_: Skip, cancel, finalized

**Rank**:
One more than the number of entries on that difficulty with a lower score, so an empty board starts at 1 and equal scores share a rank. A later entry with a strictly lower score pushes every worse entry down by one. The earlier of a tie is listed first.
_Avoid_: Potential position, provisional place, percentile

**Provisional place**:
The place the locked score would take on this difficulty's leaderboard when the win flow opens. It is not required to move while the player waits, and it is not the potential position.
_Avoid_: Rank, potential position, provisional position

**Potential position**:
The place the token preview would take on this difficulty's leaderboard if the unsent draft won. It is shown only while that draft is non-empty and a message can still be sent. It changes nothing, and it may differ from the rank of a later entry.
_Avoid_: Rank, score

**Leaderboard**:
The ranking of committed scores for a single difficulty. A lower score ranks higher. Each difficulty has its own leaderboard.
_Avoid_: Combined board, overall, all

**Leaderboard entry**:
A finalized score committed during the win flow under a required name. It records that name, the score, the target word, the round's difficulty, and the model reply that caused the win, not a later reply. The same name may appear on more than one entry. Once committed, it cannot be edited or withdrawn, and reset does not remove it.
_Avoid_: Submission
