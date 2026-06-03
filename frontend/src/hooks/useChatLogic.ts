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
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameStore } from '../store';
import { useUIStore } from '../store';
import { estimateTokenCount } from '../utils/tokenCounter';
import { fetchTargetWord, rerollWord, sendChatMessage, fetchLeaderboardRank } from '../utils/api';
import type { Difficulty } from '../utils/api/types';

export const useChatLogic = () => {
  const { setHasSeenGame, hasSeenGame } = useUIStore();

  const {
    messages,
    addMessage,
    updateLastMessage,
    sessionTokens,
    addSessionTokens,
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
    isWon,
    setIsWon,
    wonRank,
    setWonRank,
    setScoreSubmitted,
    resetSession,
  } = useGameStore();

  // Surfaced to the UI so the user can see connection problems
  const [error, setError] = useState<string | null>(null);

  /**
   * Controls whether the difficulty dialog is visible.
   * Mirrors !difficulty on mount; also opened explicitly when Reset is pressed.
   */
  const [showDifficultyDialog, setShowDifficultyDialog] = useState(!difficulty);

  /**
   * On mount, check whether the persisted messages already contain a win
   * (i.e. the user reloaded after winning but before resetting).
   * isWon and wonRank are not persisted, so they default to false/null on
   * every page load and must be rehydrated from the message history.
   */
  useEffect(() => {
    if (isWon || !targetWord || messages.length === 0) return;
    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const hasWin = messages.some((m) => m.sender === 'llm' && regex.test(m.text));
    if (hasWin) {
      setScoreSubmitted(false);
      setIsWon(true);
      fetchLeaderboardRank(sessionTokens).then(setWonRank).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally mount-only — rehydrates win state from persisted messages

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
        const result = await fetchTargetWord(difficulty as Difficulty);
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
   * 6. On `chunk` event → hide spinner, append text to placeholder
   * 7. On `done` event  → update tokens, check win condition
   * 8. On `error` event → surface error to UI
   */
  const handleSubmit = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    if (!sessionId && targetWordId === null) {
      setError('Still loading the target word — please wait a moment and try again.');
      fetchTargetWord()
        .then((r) => setTargetWord(r.word, r.id))
        .catch(() => {});
      return;
    }

    setError(null);

    const trimmedMessage = messageText.trim();
    const userTokens = estimateTokenCount(trimmedMessage);

    // flushSync forces React to commit these updates to the DOM synchronously
    // before the fetch starts. Without it, React 18 schedules the render via a
    // MessageChannel macrotask which can lose a race against a fast local
    // server — the first SSE chunk would arrive before the user message
    // was painted, causing it to appear only when the LLM response began.
    flushSync(() => {
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
          if (!sessionId) setSessionId(id);
        },
        onChunk: (chunk) => {
          // Hide the spinner as soon as the first character arrives
          setIsLoading(false);
          updateLastMessage(chunk);
        },
        onDone: ({ totalTokens, gameOver, llmVictoryMessage }) => {
          setIsLoading(false);
          if (gameOver) {
            // Add an empty placeholder for the loss-acknowledgement message
            // that will be filled by onLossChunk below.
            addMessage({ text: '', sender: 'llm' });
            if (llmVictoryMessage) setVictoryMessage(llmVictoryMessage);
            fetchLeaderboardRank(totalTokens)
              .then((rank) => {
                setScoreSubmitted(false);
                setWonRank(rank);
                setIsWon(true);
              })
              .catch(() => {
                setScoreSubmitted(false);
                setIsWon(true);
              });
          }
        },
        onLossChunk: (chunk) => {
          updateLastMessage(chunk);
        },
        onLossDone: () => {
          // Loss message fully received — nothing extra needed; win state
          // is already set (or in flight) from onDone above.
        },
        onError: (err) => {
          setIsLoading(false);
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
    setShowDifficultyDialog(true);
  };

  /**
   * Called when the player confirms a difficulty in the dialog.
   * On first visit: records the visit and stays on chat page.
   * On subsequent visits (reset): clears the session then applies the
   * new difficulty so the word-fetch effect fires immediately.
   */
  const handleDifficultyConfirm = (chosenDifficulty: Difficulty) => {
    setShowDifficultyDialog(false);
    if (!hasSeenGame) {
      // First visit: just set difficulty, stay on chat
      setHasSeenGame();
      setDifficulty(chosenDifficulty);
    } else {
      // Reset path: clear session then restore difficulty
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
    wonRank,
    error,
    handleSubmit,
    handleReset,
    handleReroll,
    isRerolling,
  };
};
