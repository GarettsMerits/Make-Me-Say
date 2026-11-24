/**
 * PromptPanel — win-flow bar state: 'prompt'
 *
 * Congratulates the player, shows their token count and leaderboard rank,
 * and offers two actions: submit score or decline.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { formatTokenCount } from '../../../utils/tokenCounter';
import { rankLabel, rankColourClass, leaderboardPlaceSentence } from '../../../utils/rankHelpers';

export interface PromptPanelProps {
  sessionTokens: number;
  wonRank: number | null;
  rankUnavailable: boolean;
  onSubmit: () => void;
  onDecline: () => void;
}

const PromptPanel: React.FC<PromptPanelProps> = ({
  sessionTokens,
  wonRank,
  rankUnavailable,
  onSubmit,
  onDecline,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="h-full space-y-3 flex flex-col justify-center"
  >
    {/* Congratulatory headline */}
    <div className="text-center space-y-1">
      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        🎉 You won!
      </p>
      <p className="text-sm app-muted">
        It took you{' '}
        <span className="font-medium app-muted-bright">{formatTokenCount(sessionTokens)}</span>
        {' '}to crack it.{' '}
        {wonRank === null ? leaderboardPlaceSentence(null, rankUnavailable) : (
          <>
            Your provisional place is{' '}
            <span className={`font-semibold ${rankColourClass(wonRank)}`}>
              {rankLabel(wonRank)}
            </span>
            .
          </>
        )}
      </p>
    </div>

    {/* Action buttons */}
    <div className="grid grid-cols-3 gap-2">
      <motion.button
        type="button"
        onClick={onSubmit}
        whileTap={{ scale: 0.97 }}
        className="btn btn-primary col-span-2 py-2 text-sm font-medium"
      >
        Submit my score!
      </motion.button>

      <motion.button
        type="button"
        onClick={onDecline}
        whileTap={{ scale: 0.97 }}
        className="btn btn-secondary col-span-1 py-2 px-2 text-sm"
        title="Skip score submission"
      >
        No, thanks.
      </motion.button>
    </div>
  </motion.div>
);

export default PromptPanel;
