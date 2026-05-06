/**
 * useChatDialogs — dialog state and handler logic for ChatPage.
 *
 * Owns two orthogonal dialog flows:
 *
 *  1. resetDialog     — "Start a new game?" triggered from the normal input bar
 *  2. pendingConfirm  — dialogs lifted from VictoryBar (decline score / reset
 *                       after declining). VictoryBar passes a callback for the
 *                       action to run on confirm; this hook stores it until the
 *                       player responds.
 *
 * Accepting handleReset and clearInput as parameters keeps the hook pure and
 * avoids reaching outside its own module boundary.
 */
import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendingConfirmKind = 'decline' | 'reset-victory';

export interface PendingConfirm {
  kind: PendingConfirmKind;
  /** Action to execute when the player confirms the dialog. */
  cb: () => void;
}

export interface UseChatDialogsReturn {
  // ── State (consumed by ChatDialogs) ────────────────────────────────────────
  resetDialogOpen: boolean;
  pendingConfirm: PendingConfirm | null;

  // ── Triggers (called by input components) ──────────────────────────────────
  /** Open the "Start a new game?" dialog for the normal input bar. */
  openResetDialog: () => void;
  /** Tell ChatPage a decline confirmation is needed; `cb` runs if confirmed. */
  onRequestDeclineConfirm: (cb: () => void) => void;
  /** Tell ChatPage a victory-reset confirmation is needed; `cb` runs if confirmed. */
  onRequestResetConfirm: (cb: () => void) => void;

  // ── Responses (passed to ConfirmDialog onConfirm / onCancel) ───────────────
  confirmReset: () => void;
  cancelReset: () => void;
  confirmPending: () => void;
  cancelPending: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChatDialogs(
  handleReset: () => boolean,
  clearInput: () => void,
): UseChatDialogsReturn {
  const [resetDialogOpen, setResetDialogOpen]   = useState(false);
  const [pendingConfirm,  setPendingConfirm]     = useState<PendingConfirm | null>(null);

  const openResetDialog = useCallback(() => setResetDialogOpen(true), []);

  const confirmReset = useCallback(() => {
    setResetDialogOpen(false);
    if (handleReset()) clearInput();
  }, [handleReset, clearInput]);

  const cancelReset = useCallback(() => setResetDialogOpen(false), []);

  const onRequestDeclineConfirm = useCallback((cb: () => void) => {
    setPendingConfirm({ kind: 'decline', cb });
  }, []);

  const onRequestResetConfirm = useCallback((cb: () => void) => {
    setPendingConfirm({ kind: 'reset-victory', cb });
  }, []);

  const confirmPending = useCallback(() => {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === 'decline') {
      pendingConfirm.cb();
    } else {
      handleReset();
      clearInput();
    }
    setPendingConfirm(null);
  }, [pendingConfirm, handleReset, clearInput]);

  const cancelPending = useCallback(() => setPendingConfirm(null), []);

  return {
    resetDialogOpen,
    pendingConfirm,
    openResetDialog,
    onRequestDeclineConfirm,
    onRequestResetConfirm,
    confirmReset,
    cancelReset,
    confirmPending,
    cancelPending,
  };
}
