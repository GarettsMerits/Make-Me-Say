/**
 * DeclinedPanel — victory bar state: 'declined'
 *
 * Shown when the player opts out of submitting their score.
 * Mirrors the standard MessageInputBox layout but with the textarea and
 * submit button permanently disabled. The Reset button is the only active
 * control, guiding the player to start a new game.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { MESSAGE_GRID, INPUT_BOX } from '../../../styles/chatLayout';

export interface DeclinedPanelProps {
  onReset: () => void;
}

const DeclinedPanel: React.FC<DeclinedPanelProps> = ({ onReset }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="h-full space-y-2 flex flex-col justify-center"
  >
    {/* Status line */}
    <div className="flex justify-between items-center mb-2 text-sm app-muted">
      <span>Game over — hit Reset to play again.</span>
    </div>

    {/* Disabled input + button grid (mirrors MessageInputBox layout) */}
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `1fr ${MESSAGE_GRID.rightColumnWidthPx}` }}
    >
      {/* Disabled textarea stand-in */}
      <div
        className="app-textarea opacity-50 cursor-not-allowed flex items-end pb-8 relative"
        style={{ height: INPUT_BOX.textareaHeightPx }}
        aria-disabled="true"
      >
        <span className="absolute bottom-2 left-4 text-xs app-muted">0 tokens</span>
      </div>

      {/* Right column: reset (active) + submit (permanently disabled) */}
      <div
        className="flex flex-col gap-2"
        style={{ height: INPUT_BOX.textareaHeightPx, width: MESSAGE_GRID.rightColumnWidthPx }}
      >
        <button
          type="button"
          onClick={onReset}
          className="flex-1 btn-secondary flex items-center justify-center text-2xl"
          title="Reset chat"
        >
          🔄
        </button>

        <button
          type="button"
          disabled
          className="flex-1 btn-primary flex items-center justify-center text-xl opacity-40 cursor-not-allowed"
          title="Win the game to submit"
        >
          →
        </button>
      </div>
    </div>
  </motion.div>
);

export default DeclinedPanel;
