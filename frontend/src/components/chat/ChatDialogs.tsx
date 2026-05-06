/**
 * ChatDialogs — renders the three ConfirmDialog overlays for ChatPage.
 *
 * All dialogs are rendered as direct children of the ChatPage root (an
 * `absolute inset-0` div) so the backdrop covers the full chat area,
 * including the sticky bar at the bottom, without affecting the TopRibbon.
 *
 * Dialog inventory:
 *  1. resetDialog     — "Start a new game?" from the normal input bar
 *  2. decline         — "Skip score submission?" from VictoryBar prompt state
 *  3. reset-victory   — "Start a new game?" from VictoryBar declined state
 */
import React from 'react';
import { AnimatePresence } from 'framer-motion';
import ConfirmDialog from '../ConfirmDialog';
import type { PendingConfirm } from '../../hooks/useChatDialogs';

export interface ChatDialogsProps {
  resetDialogOpen: boolean;
  pendingConfirm: PendingConfirm | null;
  onConfirmReset: () => void;
  onCancelReset: () => void;
  onConfirmPending: () => void;
  onCancelPending: () => void;
}

const ChatDialogs: React.FC<ChatDialogsProps> = ({
  resetDialogOpen,
  pendingConfirm,
  onConfirmReset,
  onCancelReset,
  onConfirmPending,
  onCancelPending,
}) => (
  <>
    {/* 1. Normal input bar — reset */}
    <AnimatePresence>
      {resetDialogOpen && (
        <ConfirmDialog
          key="reset-dialog"
          message="Start a new game?"
          detail="The current session will be cleared."
          confirmLabel="New game"
          cancelLabel="Cancel"
          onConfirm={onConfirmReset}
          onCancel={onCancelReset}
        />
      )}
    </AnimatePresence>

    {/* 2. VictoryBar prompt — skip score submission */}
    <AnimatePresence>
      {pendingConfirm?.kind === 'decline' && (
        <ConfirmDialog
          key="decline-dialog"
          message="Skip score submission?"
          detail="Your score won't be saved to the leaderboard."
          confirmLabel="Skip"
          cancelLabel="Go back"
          onConfirm={onConfirmPending}
          onCancel={onCancelPending}
        />
      )}
    </AnimatePresence>

    {/* 3. VictoryBar declined state — start a new game */}
    <AnimatePresence>
      {pendingConfirm?.kind === 'reset-victory' && (
        <ConfirmDialog
          key="reset-victory-dialog"
          message="Start a new game?"
          detail="The current session will be cleared."
          confirmLabel="New game"
          cancelLabel="Cancel"
          onConfirm={onConfirmPending}
          onCancel={onCancelPending}
        />
      )}
    </AnimatePresence>
  </>
);

export default ChatDialogs;
