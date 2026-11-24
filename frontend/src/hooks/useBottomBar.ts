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
import type { VictoryState } from '../store/types';
import { winFlowPhase } from '../store/winFlowPhase';
import { estimateTokenCount } from '../utils/tokenCounter';
import { declineSession, fetchLeaderboardRank, submitScore } from '../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { VictoryState };

/** Which flavour of pending confirmation is waiting for the player's response. */
export type DialogKind = 'decline';

export interface PendingDialog {
  kind:      DialogKind;
  onConfirm: () => void;
}

export interface UseBottomBarProps {
  /** Receives the trimmed message text and initiates the LLM stream. */
  onSubmit: (text: string) => void;
  /** Clears the game session and triggers a fresh target-word fetch. */
  onReset:  () => void;
  /** Restores the composer after the server rejects a turn. */
  rejectedDraft?: { id: number; text: string } | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBottomBar({ onSubmit, onReset, rejectedDraft }: UseBottomBarProps) {

  // ── Store access ─────────────────────────────────────────────────────────────
  const {
    sessionTokens, lockedScore, targetWord, sessionId, difficulty,
    isLoading, isWon, wonRank, rankUnavailable, scoreSubmitted, setScoreSubmitted,
    lockScore, setWonRank,
    victoryState, setVictoryState,
    draft, setDraft, setScoreName,
  } = useGameStore();

  const { setCurrentPage, setPendingHighlightId, setLeaderboardTab } = useUIStore();

  // ── Message input ─────────────────────────────────────────────────────────────
  const inputText = draft;
  const setInputText = setDraft;

  const inputTokens = useMemo(
    () => estimateTokenCount(inputText),
    [inputText],
  );

  /**
   * The figure on screen. While a message can still be sent it is the token
   * preview, including this draft. From the win onward it is the locked score.
   */
  const phase = winFlowPhase({ isWon, scoreSubmitted, victoryState });

  const shownFigure = phase === 'playing'
    ? sessionTokens + (isLoading ? 0 : inputTokens)
    : (lockedScore ?? sessionTokens);

  /**
   * The place this token preview would take on this difficulty if the draft
   * won. Hidden unless a non-empty draft can still be sent.
   */
  const [potentialPosition, setPotentialPosition] = useState<number | null>(null);
  useEffect(() => {
    const draftText = inputText.trim();
    if (!draftText || isLoading || phase !== 'playing' || !difficulty) {
      setPotentialPosition(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchLeaderboardRank(shownFigure, difficulty)
        .then((place) => { if (!cancelled) setPotentialPosition(place); })
        .catch(() => { if (!cancelled) setPotentialPosition(null); });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inputText, isLoading, phase, difficulty, shownFigure]);

  const clearInput = useCallback(() => setDraft(''), [setDraft]);

  useEffect(() => {
    if (rejectedDraft) setDraft(rejectedDraft.text);
  }, [rejectedDraft, setDraft]);

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
    if (!sessionId) {
      throw new Error('This game has no server session, so the score cannot be saved.');
    }

    let entryId: number | null = null;

    try {
      const result = await submitScore({ playerName, sessionId });
      entryId = result.id;
      lockScore(result.tokenCount);
      setWonRank(result.rank);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already submitted')) {
        // A retry after the first insert succeeded. Leave the board without a highlight.
      } else {
        throw err;
      }
    }

    setScoreSubmitted(true);
    setScoreName('');
    if (entryId !== null) setPendingHighlightId(entryId);
    if (difficulty) setLeaderboardTab(difficulty);
    setCurrentPage('leaderboard');
  }, [
    sessionId, difficulty,
    setScoreSubmitted, setScoreName, lockScore, setWonRank, setPendingHighlightId, setLeaderboardTab, setCurrentPage,
  ]);

  // ── Dialogs ───────────────────────────────────────────────────────────────────
  const [pendingDialog, setPendingDialog] = useState<PendingDialog | null>(null);

  /** Triggered by PromptPanel's "No, thanks." — shows the decline confirmation. */
  const requestDeclineConfirm = useCallback(() => {
    setPendingDialog({
      kind:      'decline',
      onConfirm: () => {
        const id = useGameStore.getState().sessionId;
        if (!id) return;
        declineSession(id)
          .then(() => setVictoryState('declined'))
          .catch(() => {});
      },
    });
  }, []);

  /** Triggered by DeclinedPanel's Reset button — opens the difficulty/new-game dialog. */
  const requestResetConfirm = useCallback(() => {
    onReset();
    clearInput();
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
    submitMessage,

    // Session / game state (read-only, sourced from stores)
    sessionTokens,
    shownFigure,
    potentialPosition,
    scoreLocked: phase !== 'playing',
    phase,
    targetWord,
    isLoading,
    isWon,
    wonRank,
    rankUnavailable,
    scoreSubmitted,

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
