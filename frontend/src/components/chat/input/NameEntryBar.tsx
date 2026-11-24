/**
 * NameEntryBar component
 *
 * Shown inside VictoryBar when the player chooses to submit their score.
 * Provides a text input for their display name, a score / rank recap, a
 * confirm button (✓), and an X button to cancel back to the victory prompt.
 *
 * HEIGHT CONTRACT:
 * The outer wrapper uses BAR_BOTTOM.minHeightPx so the bottom bar never
 * changes height when transitioning between VictoryBar states.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../store';
import { formatTokenCount } from '../../../utils/tokenCounter';
import { rankLabel, rankColourClass, leaderboardPlaceSentence } from '../../../utils/rankHelpers';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NameEntryBarProps {
  targetWord: string;
  sessionTokens: number;
  wonRank: number | null;
  rankUnavailable: boolean;
  /** Called with the validated, trimmed name when the player confirms. */
  onConfirm: (name: string) => Promise<void>;
  /** Called when the player presses X to go back to the victory prompt. */
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NameEntryBar: React.FC<NameEntryBarProps> = ({
  targetWord,
  sessionTokens,
  wonRank,
  rankUnavailable,
  onConfirm,
  onCancel,
}) => {
  const name = useGameStore((state) => state.scoreName);
  const setName = useGameStore((state) => state.setScoreName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (trimmed.length > 32) { setError('Name must be 32 characters or fewer.'); return; }
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full space-y-3 flex flex-col justify-center"
    >
      {/* Score recap row */}
      <div className="text-sm app-body">
        You made the LLM say{' '}
        <span className="font-semibold app-muted-bright">{targetWord}</span>
        {' '}in{' '}
        <span className="font-semibold app-muted-bright">{formatTokenCount(sessionTokens)}</span>
        {wonRank === null ? (
          `. ${leaderboardPlaceSentence(null, rankUnavailable)}`
        ) : (
          <>
            . Your provisional place is{' '}
            <span className={`font-semibold ${rankColourClass(wonRank)}`}>{rankLabel(wonRank)}</span>
            .
          </>
        )}
      </div>

      {/* Name field + action buttons — compact row */}
      <div className="flex items-stretch gap-2">
        {/* Expands to fill remaining width */}
        <div className="relative flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            placeholder="Enter your name…"
            maxLength={32}
            autoFocus
            className={[
              'w-full px-4 py-3',
              'bg-layer-3-light dark:bg-layer-3-dark',
              'text-gray-800 dark:text-gray-100 rounded-lg',
              'border',
              error
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'disabled:opacity-50',
            ].join(' ')}
            disabled={isSubmitting}
          />
          {error && (
            <p className="absolute -bottom-5 left-0 text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Confirm (✓) and Cancel (✕) — square, side by side, confirm on left */}
        <motion.button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting || !name.trim()}
          whileTap={!isSubmitting && !!name.trim() ? { scale: 0.97 } : {}}
          className="btn btn-primary flex size-12 shrink-0 items-center justify-center self-center text-lg font-medium"
          title="Submit score"
        >
          {isSubmitting ? '…' : '✓'}
        </motion.button>

        <motion.button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          whileTap={!isSubmitting ? { scale: 0.97 } : {}}
          className="btn btn-secondary flex size-12 shrink-0 items-center justify-center self-center text-lg"
          title="Cancel"
        >
          ✕
        </motion.button>
      </div>

      {/* Spacer to clear the floating error label */}
      {error && <div className="h-2" />}
    </motion.div>
  );
};

export default NameEntryBar;
