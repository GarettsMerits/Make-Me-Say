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
import { useGameStore } from '../store';
import { estimateTokenCount } from '../utils/tokenCounter';
import { fetchTargetWord, sendChatMessage, fetchLeaderboardRank } from '../utils/api';

export const useChatLogic = () => {
  const {
    messages,
    addMessage,
    updateLastMessage,
    sessionTokens,
    addSessionTokens,
    targetWord,
    targetWordId,
    setTargetWord,
    isLoading,
    setIsLoading,
    sessionId,
    setSessionId,
    isWon,
    setIsWon,
    wonRank,
    setWonRank,
    resetSession,
  } = useGameStore();

  // Surfaced to the UI so the user can see connection problems
  const [error, setError] = useState<string | null>(null);

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
      setIsWon(true);
      fetchLeaderboardRank(sessionTokens).then(setWonRank).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally mount-only — rehydrates win state from persisted messages

  /**
   * Fetch a target word from the backend on mount (or when targetWord is empty).
   */
  useEffect(() => {
    // Already have everything we need — nothing to do
    if (targetWord && targetWordId !== null) return;

    // Stale persisted session: word string is present but DB id was never saved
    // (can happen if the store was saved before targetWordId was added to the schema).
    // Reset so the stale chat history is cleared; the effect will re-run with
    // an empty targetWord and fetch a fresh word + id.
    if (targetWord && targetWordId === null) {
      resetSession();
      return;
    }

    // targetWord is empty — fetch a fresh word
    let cancelled = false;

    async function loadTargetWord() {
      try {
        const result = await fetchTargetWord();
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
  }, [targetWord, targetWordId, setTargetWord]);

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

    // Add user message immediately so the UI feels responsive
    addMessage({ text: trimmedMessage, sender: 'user', tokenCount: userTokens });
    addSessionTokens(userTokens);

    // Add empty LLM placeholder — chunks will fill it in
    addMessage({ text: '', sender: 'llm' });
    setIsLoading(true);

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
        onDone: ({ totalTokens, gameOver }) => {
          setIsLoading(false);
          if (gameOver) {
            // Add an empty placeholder for the loss-acknowledgement message
            // that will be filled by onLossChunk below.
            addMessage({ text: '', sender: 'llm' });
            fetchLeaderboardRank(totalTokens)
              .then((rank) => {
                setWonRank(rank);
                setIsWon(true);
              })
              .catch(() => {
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
   * Reset the session — clears messages, tokens, target word, and session ID.
   * A fresh target word will be fetched automatically by the useEffect above.
   * The caller is responsible for showing a confirmation dialog before calling this.
   */
  const handleReset = () => {
    resetSession();
    return true;
  };

  return {
    messages,
    sessionTokens,
    targetWord,
    sessionId,
    isLoading,
    isWon,
    wonRank,
    error,
    handleSubmit,
    handleReset,
  };
};
