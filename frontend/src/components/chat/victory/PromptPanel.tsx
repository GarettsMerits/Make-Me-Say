/**
 * PromptPanel — victory bar state: 'prompt'
 *
 * Congratulates the player, shows their token count and leaderboard rank,
 * and offers two actions: submit score or decline.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { MESSAGE_GRID, BAR_BOTTOM } from '../../../styles/chatLayout';
import { formatTokenCount } from '../../../utils/tokenCounter';
import { rankLabel, rankColourClass } from '../../../utils/rankHelpers';

export interface PromptPanelProps {
  sessionTokens: number;
  wonRank: number;
  onSubmit: () => void;
  onDecline: () => void;
}

const PromptPanel: React.FC<PromptPanelProps> = ({
  sessionTokens,
  wonRank,
  onSubmit,
  onDecline,
}) => (
  <motion.div
    key="prompt"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.25 }}
    className="space-y-3 flex flex-col justify-center"
    style={{ minHeight: BAR_BOTTOM.minHeightPx }}
  >
    {/* Congratulatory headline */}
    <div className="text-center space-y-1">
      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        🎉 You won!
      </p>
      <p className="text-sm app-muted">
        It took you{' '}
        <span className="font-medium app-muted-bright">{formatTokenCount(sessionTokens)}</span>
        {' '}to crack it — that puts you at{' '}
        <span className={`font-semibold ${rankColourClass(wonRank)}`}>
          {rankLabel(wonRank)}
        </span>
        {' '}on the leaderboard.
      </p>
    </div>

    {/* Action buttons */}
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `1fr ${MESSAGE_GRID.rightColumnWidthPx}` }}
    >
      <motion.button
        type="button"
        onClick={onSubmit}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="btn btn-primary py-2 text-sm font-medium"
      >
        Submit my score!
      </motion.button>

      <motion.button
        type="button"
        onClick={onDecline}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="btn btn-secondary py-2 text-sm"
        title="Skip score submission"
      >
        No, thanks.
      </motion.button>
    </div>
  </motion.div>
);

export default PromptPanel;
