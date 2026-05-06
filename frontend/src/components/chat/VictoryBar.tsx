/**
 * VictoryBar — bottom bar shown when the player wins.
 *
 * Orchestrates three sequential states via AnimatePresence:
 *
 *  'prompt'   → PromptPanel   — congratulations + "Submit" / "No thanks" choice
 *  'enter'    → NameEntryBar  — username input and score submission
 *  'declined' → DeclinedPanel — game-over placeholder; Reset is the only action
 *
 * ConfirmDialogs for both the decline and reset flows are owned by ChatPage
 * (so the overlay escapes the sticky bar stacking context). VictoryBar signals
 * the need for a dialog via the two `onRequest*Confirm` callback props.
 *
 * HEIGHT CONTRACT:
 *  All three panels respect BAR_BOTTOM.minHeightPx so the bar never reflows
 *  during state transitions.
 */
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { getChatContainerClasses } from '../../styles/chatLayout';
import { submitScore } from '../../utils/api';
import PromptPanel from './victory/PromptPanel';
import DeclinedPanel from './victory/DeclinedPanel';
import NameEntryBar from './input/NameEntryBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type VictoryState = 'prompt' | 'enter' | 'declined';

export interface VictoryBarProps {
  targetWord: string;
  sessionId: string;
  sessionTokens: number;
  wonRank: number;
  /**
   * Called when the player clicks "No, thanks."
   * `onConfirmed` should be invoked if the player confirms the skip dialog.
   * VictoryBar passes `() => setState('declined')` as the action.
   */
  onRequestDeclineConfirm: (onConfirmed: () => void) => void;
  /**
   * Called when the player clicks Reset in the declined state.
   * `onConfirmed` should be invoked if the player confirms the new-game dialog.
   */
  onRequestResetConfirm: (onConfirmed: () => void) => void;
  /**
   * Called with the new leaderboard entry id after a successful submission.
   * Receives `null` when the score was already saved (e.g. after a network
   * retry) — callers should still navigate to the leaderboard but skip the
   * highlight scroll.
   */
  onScoreSubmitted: (entryId: number | null) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const VictoryBar: React.FC<VictoryBarProps> = ({
  targetWord,
  sessionId,
  sessionTokens,
  wonRank,
  onRequestDeclineConfirm,
  onRequestResetConfirm,
  onScoreSubmitted,
}) => {
  const [state, setState] = useState<VictoryState>('prompt');

  const handleConfirmName = async (playerName: string) => {
    try {
      const result = await submitScore({
        playerName,
        tokenCount: sessionTokens,
        targetWord,
        sessionId,
      });
      onScoreSubmitted(result.id);
    } catch (err) {
      // The score was already saved on a previous attempt (network retry → 409).
      // Navigate to the leaderboard anyway; we just can't highlight the entry.
      if (err instanceof Error && err.message.includes('already submitted')) {
        onScoreSubmitted(null);
      } else {
        throw err; // Let NameEntryBar display the error
      }
    }
  };

  return (
    <div className="bar-bottom">
      <div className={getChatContainerClasses('py-4')}>
        <AnimatePresence mode="popLayout">
          {state === 'prompt' && (
            <PromptPanel
              key="prompt"
              sessionTokens={sessionTokens}
              wonRank={wonRank}
              onSubmit={() => setState('enter')}
              onDecline={() => onRequestDeclineConfirm(() => setState('declined'))}
            />
          )}
          {state === 'enter' && (
            <NameEntryBar
              key="enter"
              targetWord={targetWord}
              sessionTokens={sessionTokens}
              wonRank={wonRank}
              onConfirm={handleConfirmName}
              onCancel={() => setState('prompt')}
            />
          )}
          {state === 'declined' && (
            <DeclinedPanel
              key="declined"
              onReset={() => onRequestResetConfirm(() => {})}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VictoryBar;
