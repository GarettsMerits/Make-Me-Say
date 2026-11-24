/**
 * Custom hook for managing chat message logic
 *
 * SEPARATION OF CONCERNS:
 * - Handles all message submission and LLM response logic
 * - Manages loading states and error states
 * - Checks win conditions
 * - Keeps business logic separate from UI rendering
 *
 * REAL API INTEGRATION:
 * - Calls the backend /api/chat endpoint via api.ts
 * - Fetches the target word from /api/target-word on first render
 * - Tracks the backend session ID so conversation history is preserved server-side
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameStore } from '../store';
import { useUIStore } from '../store';
import { estimateTokenCount } from '../utils/tokenCounter';
import { abandonSession, rerollWord, sendChatMessage, fetchLeaderboardRank, targetWordDeal } from '../utils/api';
import type { Difficulty } from '../utils/api/types';

export const useChatLogic = () => {
  const { setHasSeenGame, hasSeenGame } = useUIStore();

  const {
    messages,
    addMessage,
    updateLastMessage,
    sessionTokens,
    lockedScore,
    addSessionTokens,
    setSessionTokens,
    lockScore,
    setDraft,
    setLastUserTokenCount,
    revertLastTurn,
    targetWord,
    targetWordId,
    setTargetWord,
    difficulty,
    setDifficulty,
    setVictoryMessage,
    isLoading,
    setIsLoading,
    sessionId,
    setSessionId,
    setVictoryState,
    isWon,
    setIsWon,
    winningMessageId,
    setWinningMessageId,
    scoreSubmitted,
    wonRank,
    setWonRank,
    setRankUnavailable,
    resetSession,
  } = useGameStore();

  // Surfaced to the UI so the user can see connection problems
  const [error, setError] = useState<string | null>(null);
  /** Set when a turn is rejected so the composer can put the draft back. */
  const [rejectedDraft, setRejectedDraft] = useState<{ id: number; text: string } | null>(null);

  /**
   * Controls whether the difficulty dialog is visible.
   * Mirrors !difficulty on mount; also opened explicitly when Reset is pressed.
   */
  const [showDifficultyDialog, setShowDifficultyDialog] = useState(!difficulty);

  /**
   * A reload restores the win the server already locked. The browser does not
   * scan the transcript to decide that a win happened. A committed round
   * reads the current rank again. An undecided win keeps the place it stored.
   */
  const didRestoreWin = useRef(false);
  /** Bumped when a turn starts and when reset ends the round, so a late loss chunk cannot land on the next one. */
  const turnGeneration = useRef(0);
  useEffect(() => {
    if (didRestoreWin.current || lockedScore === null) return;
    didRestoreWin.current = true;
    if (!isWon) setIsWon(true);
    if (!scoreSubmitted && wonRank !== null) return;
    if (!difficulty) {
      setRankUnavailable(true);
      return;
    }
    fetchLeaderboardRank(lockedScore, difficulty)
      .then(setWonRank)
      .catch(() => setRankUnavailable(true));
  }, [lockedScore, isWon, scoreSubmitted, wonRank, difficulty, setIsWon, setWonRank, setRankUnavailable]);

  /**
   * Fetch a target word from the backend on mount (or when targetWord is empty).
   * Skipped if difficulty has not yet been chosen (dialog not confirmed).
   */
  useEffect(() => {
    // Wait for the player to select a difficulty before fetching
    if (!difficulty) return;

    // Already have everything we need — nothing to do
    if (targetWord && targetWordId !== null) return;

    // Stale persisted session: word string is present but DB id was never saved
    if (targetWord && targetWordId === null) {
      resetSession();
      return;
    }

    // targetWord is empty — fetch a fresh word for the chosen difficulty
    let cancelled = false;

    async function loadTargetWord() {
      try {
        const result = await targetWordDeal.load(difficulty as Difficulty);
        if (!cancelled) setTargetWord(result.word, result.id);
      } catch (err) {
        if (!cancelled) {
          const detail = err instanceof Error ? `: ${err.message}` : '';
          setError(`Could not load a target word${detail}`);
        }
      }
    }

    loadTargetWord();
    return () => { cancelled = true; };
  // resetSession is stable (Zustand action) so omitting it from deps is safe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetWord, targetWordId, difficulty, setTargetWord]);

  /**
   * Submit a user message and stream the LLM response from the backend.
   *
   * ASYNC FLOW:
   * 1. Optimistically add the user message to the UI
   * 2. Add an empty LLM placeholder message (text fills in as chunks arrive)
   * 3. Set loading state to show the typing indicator until the first chunk
   * 4. Open an SSE stream to POST /api/chat
   * 5. On `meta` event  → store the sessionId (first message only)
   * 6. On `chunk` event → append text to the placeholder. The reply is still in flight.
   * 7. On `done` event  → the reply has finished; update tokens and check the win
   * 8. On `error` event → surface error to UI
   */
  const handleSubmit = async (messageText: string) => {
    if (!messageText.trim() || isLoading || isWon) return;

    if (!sessionId && targetWordId === null) {
      setError('Still loading the target word — please wait a moment and try again.');
      targetWordDeal.load(difficulty ?? undefined)
        .then((r) => setTargetWord(r.word, r.id))
        .catch(() => {});
      return;
    }

    setError(null);

    const trimmedMessage = messageText.trim();
    const userTokens = estimateTokenCount(trimmedMessage);
    const hadSession = Boolean(sessionId);
    let turnSettled = false;
    const generation = ++turnGeneration.current;

    // flushSync forces React to commit these updates to the DOM synchronously
    // before the fetch starts. Without it, React 18 schedules the render via a
    // MessageChannel macrotask which can lose a race against a fast local
    // server — the first SSE chunk would arrive before the user message
    // was painted, causing it to appear only when the LLM response began.
    flushSync(() => {
      setDraft('');
      addMessage({ text: trimmedMessage, sender: 'user', tokenCount: userTokens });
      addSessionTokens(userTokens);
      // Add empty LLM placeholder — chunks will fill it in
      addMessage({ text: '', sender: 'llm' });
      setIsLoading(true);
    });

    await sendChatMessage(
      sessionId
        ? { sessionId, message: trimmedMessage }
        : { targetWordId: targetWordId ?? undefined, message: trimmedMessage },
      {
        onSessionId: (id) => {
          if (!hadSession) setSessionId(id);
        },
        onChunk: (chunk) => {
          if (generation !== turnGeneration.current) return;
          updateLastMessage(chunk);
        },
        onDone: ({ playerTokens, userTokenCount, gameOver, llmVictoryMessage }) => {
          if (generation !== turnGeneration.current) return;
          turnSettled = true;
          setIsLoading(false);
          if (gameOver) {
            const winning = [...useGameStore.getState().messages]
              .reverse()
              .find((message) => message.sender === 'llm' && message.text);
            if (winning) setWinningMessageId(winning.id);
            const score = typeof playerTokens === 'number' ? playerTokens : sessionTokens;
            lockScore(score);
            if (typeof userTokenCount === 'number') setLastUserTokenCount(userTokenCount);
            // Placeholder for the loss acknowledgement filled by onLossChunk.
            addMessage({ text: '', sender: 'llm' });
            if (llmVictoryMessage) setVictoryMessage(llmVictoryMessage);
            setVictoryState('prompt');
            if (difficulty) {
              fetchLeaderboardRank(score, difficulty)
                .then(setWonRank)
                .catch(() => setRankUnavailable(true));
            } else {
              setRankUnavailable(true);
            }
          } else if (typeof playerTokens === 'number') {
            setSessionTokens(playerTokens);
            if (typeof userTokenCount === 'number') setLastUserTokenCount(userTokenCount);
          }
        },
        onLossChunk: (chunk) => {
          if (generation !== turnGeneration.current) return;
          updateLastMessage(chunk);
        },
        onLossDone: () => {
          // Loss message fully received — nothing extra needed; win state
          // is already set (or in flight) from onDone above.
        },
        onError: (err) => {
          if (generation !== turnGeneration.current) return;
          setIsLoading(false);
          if (!turnSettled) {
            revertLastTurn(userTokens);
            if (!hadSession) setSessionId(null);
            setRejectedDraft({ id: Date.now(), text: trimmedMessage });
          }
          setError(err.message);
        },
      }
    );
  };

  /**
   * Opens the difficulty dialog instead of resetting immediately.
   * The dialog's onConfirm will call handleDifficultyConfirm which resets
   * the session with the chosen difficulty.
   * Always available — no messages required.
   */
  const handleReset = () => {
    // A reply already on its way can still win. Reset waits until it finishes.
    if (isLoading) return;
    setShowDifficultyDialog(true);
  };

  /**
   * Called when the player confirms a difficulty in the dialog.
   * On first visit: records the visit and stays on chat page.
   * On subsequent visits (reset): clears the session then applies the
   * new difficulty so the word-fetch effect fires immediately.
   */
  const handleDifficultyConfirm = (chosenDifficulty: Difficulty) => {
    if (useGameStore.getState().isLoading) return;
    turnGeneration.current += 1;
    setShowDifficultyDialog(false);
    if (!hasSeenGame) {
      // First visit: just set difficulty, stay on chat
      setHasSeenGame();
      setDifficulty(chosenDifficulty);
    } else {
      // Reset path: close the server session, then clear local state.
      if (sessionId) {
        abandonSession(sessionId).catch(() => {});
      }
      resetSession();
      setDifficulty(chosenDifficulty);
    }
  };

  /**
   * Reroll the target word without a confirmation dialog.
   * Only valid when no messages exist yet. Notifies the backend before
   * clearing, then resetSession triggers the fetch effect to load a new word.
   */
  const handleReroll = () => {
    if (messages.length > 0) return;
    if (!targetWord) return;
    const currentDifficulty = difficulty;
    if (targetWordId !== null) {
      rerollWord(targetWordId).catch(() => {});
    }
    resetSession();
    // Re-apply difficulty so the dialog doesn't re-appear on reroll
    if (currentDifficulty) setDifficulty(currentDifficulty);
  };

  /** True while the initial target-word fetch is pending (difficulty chosen but word not yet loaded). */
  const isRerolling = !!difficulty && !targetWord;

  return {
    messages,
    sessionTokens,
    targetWord,
    sessionId,
    difficulty,
    showDifficultyDialog,
    handleDifficultyConfirm,
    isLoading,
    isWon,
    winningMessageId,
    wonRank,
    error,
    rejectedDraft,
    handleSubmit,
    handleReset,
    handleReroll,
    isRerolling,
  };
};
