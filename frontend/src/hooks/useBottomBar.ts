/**
 * useBottomBar — single source of truth for all bottom-bar state.
 *
 * Consolidates what was previously spread across three separate hooks/components:
 *  - useMessageInput  (input text, token counting, submitMessage)
 *  - useChatDialogs   (dialog open/close, confirm callbacks)
 *  - VictoryBar       (victory flow state machine, score submission)
 *
 * READS DIRECTLY FROM STORES so ChatPage doesn't need to pass session data
 * as props. The only external dependencies are the two actions that belong
 * to ChatPage's domain:
 *  - onSubmit  — initiates the LLM stream with the typed message
 *  - onReset   — clears the session and fetches a new target word
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGameStore, useUIStore } from '../store';
import { estimateTokenCount } from '../utils/tokenCounter';
import { submitScore } from '../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Three sequential states of the victory panel. */
export type VictoryState = 'prompt' | 'enter' | 'declined';

/** Which flavour of pending confirmation is waiting for the player's response. */
export type DialogKind = 'decline' | 'reset-victory';

export interface PendingDialog {
  kind:      DialogKind;
  onConfirm: () => void;
}

export interface UseBottomBarProps {
  /** Receives the trimmed message text and initiates the LLM stream. */
  onSubmit: (text: string) => void;
  /** Clears the game session and triggers a fresh target-word fetch. */
  onReset:  () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBottomBar({ onSubmit, onReset }: UseBottomBarProps) {

  // ── Store access ─────────────────────────────────────────────────────────────
  const {
    messages, sessionTokens, targetWord, sessionId,
    isLoading, isWon, wonRank, scoreSubmitted, setScoreSubmitted,
    difficulty, victoryMessage,
  } = useGameStore();

  const { setCurrentPage, setPendingHighlightId } = useUIStore();

  // ── Message input ─────────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');

  const inputTokens = useMemo(
    () => estimateTokenCount(inputText),
    [inputText],
  );

  /** Rough live estimate of where this session's score would land. */
  const potentialPosition = useMemo(
    () => Math.max(1, Math.floor((sessionTokens + inputTokens) / 10)),
    [sessionTokens, inputTokens],
  );

  const clearInput = useCallback(() => setInputText(''), []);

  /**
   * Submit the current input text.
   * Clears the field immediately so the player can start typing the next
   * message before the LLM has finished responding.
   */
  const submitMessage = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    clearInput();
  }, [inputText, onSubmit, clearInput]);

  // ── Victory flow ──────────────────────────────────────────────────────────────
  const [victoryState, setVictoryState] = useState<VictoryState>('prompt');

  // Reset victory UI whenever a new win is detected (guards against stale local state)
  useEffect(() => {
    if (isWon) setVictoryState('prompt');
  }, [isWon]);

  // ── Score submission ──────────────────────────────────────────────────────────
  /**
   * Called by NameEntryBar when the player confirms their display name.
   *
   * Submits to the leaderboard API, marks the session as scored in the store,
   * then navigates to the leaderboard page (with a highlight scroll when we
   * have a fresh entry id).
   *
   * Throws on unexpected API errors so NameEntryBar can display them inline.
   * A 409 ("already submitted") is treated as a soft success — we navigate
   * without highlighting rather than surfacing an error to the player.
   */
  const handleScoreSubmit = useCallback(async (playerName: string): Promise<void> => {
    let entryId: number | null = null;

    try {
      const result = await submitScore({
        playerName,
        tokenCount: sessionTokens,
        targetWord,
        difficulty: difficulty ?? 'normal',
        llmVictoryMessage: victoryMessage,
        sessionId: sessionId ?? '',
      });
      entryId = result.id;
    } catch (err) {
      if (err instanceof Error && err.message.includes('already submitted')) {
        // Network retry after a successful first submission — fall through and
        // navigate without a highlight rather than showing an error.
      } else {
        throw err; // Surface to NameEntryBar's inline error display
      }
    }

    setScoreSubmitted(true);
    if (entryId !== null) setPendingHighlightId(entryId);
    setCurrentPage('leaderboard');
  }, [
    sessionTokens, targetWord, sessionId,
    setScoreSubmitted, setPendingHighlightId, setCurrentPage,
  ]);

  // ── Dialogs ───────────────────────────────────────────────────────────────────
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pendingDialog,   setPendingDialog]   = useState<PendingDialog | null>(null);

  const openResetDialog = useCallback(() => setResetDialogOpen(true), []);

  const confirmReset = useCallback(() => {
    setResetDialogOpen(false);
    onReset();
    clearInput();
  }, [onReset, clearInput]);

  const cancelReset = useCallback(() => setResetDialogOpen(false), []);

  /** Triggered by PromptPanel's "No, thanks." — shows the decline confirmation. */
  const requestDeclineConfirm = useCallback(() => {
    setPendingDialog({
      kind:      'decline',
      onConfirm: () => setVictoryState('declined'),
    });
  }, []);

  /** Triggered by DeclinedPanel's Reset button — shows the new-game confirmation. */
  const requestResetConfirm = useCallback(() => {
    setPendingDialog({
      kind:      'reset-victory',
      onConfirm: () => { onReset(); clearInput(); },
    });
  }, [onReset, clearInput]);

  const confirmPending = useCallback(() => {
    pendingDialog?.onConfirm();
    setPendingDialog(null);
  }, [pendingDialog]);

  const cancelPending = useCallback(() => setPendingDialog(null), []);

  // ── Return ────────────────────────────────────────────────────────────────────
  return {
    // Input
    inputText,
    setInputText,
    inputTokens,
    potentialPosition,
    submitMessage,

    // Session / game state (read-only, sourced from stores)
    sessionTokens,
    targetWord,
    isLoading,
    isWon,
    wonRank,
    scoreSubmitted,
    hasMessages: messages.length > 0,

    // Victory flow
    victoryState,
    setVictoryState,
    handleScoreSubmit,

    // Dialogs
    pendingDialog,
    requestDeclineConfirm,
    requestResetConfirm,
    confirmPending,
    cancelPending,
  } as const;
}
