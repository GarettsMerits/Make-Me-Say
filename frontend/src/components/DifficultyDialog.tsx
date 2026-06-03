/**
 * DifficultyDialog — modal shown when the player starts a new game or resets.
 *
 * When `isReset` is true the copy is flavoured as "change difficulty / new game".
 * When `isReset` is false (first visit) the copy welcomes a new player.
 * The dialog cannot be dismissed without selecting a difficulty.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Difficulty } from '../utils/api/types';

// ─── Difficulty metadata ──────────────────────────────────────────────────────

interface DifficultyOption {
  value: Difficulty;
  label: string;
  description: string;
  colour: string; // Tailwind text-colour class
}

const OPTIONS: DifficultyOption[] = [
  {
    value:       'easy',
    label:       'Easy',
    description: `Common words the AI almost can't avoid saying — "a", "the", "you", "and"…`,
    colour:      'text-green-500 dark:text-green-400',
  },
  {
    value:       'normal',
    label:       'Normal',
    description: 'Ubiquitous nouns, verbs, and adjectives — "car", "sky", "cook", "pretty"…',
    colour:      'text-blue-500 dark:text-blue-400',
  },
  {
    value:       'hard',
    label:       'Hard',
    description: 'Specialized words the AI can more easily avoid saying — "asphalt", "circuitry", "cuisine"…',
    colour:      'text-orange-500 dark:text-orange-400',
  },
  {
    value:       'nightmare',
    label:       'Nightmare',
    description: 'Obscure, highly specific words — "trunnion", "vulpine", "brigand", "amalgamation"…',
    colour:      'text-red-500 dark:text-red-400',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DifficultyDialogProps {
  onConfirm: (difficulty: Difficulty) => void;
  /** True when shown mid-game (reset). False on first visit. */
  isReset?: boolean;
  /** The difficulty currently active, pre-selects that option when resetting. */
  currentDifficulty?: Difficulty | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DifficultyDialog: React.FC<DifficultyDialogProps> = ({ onConfirm, isReset = false, currentDifficulty }) => {
  const [selected, setSelected] = useState<Difficulty>(currentDifficulty ?? 'normal');

  const heading = isReset ? 'New Game' : 'Welcome!';
  const subheading = isReset
    ? 'Choose a difficulty for your next round, or keep the same one.'
    : 'Pick a difficulty to get started. You can change it any time by resetting.';
  const confirmLabel = isReset ? 'Start New Game' : "Let's Play!";

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="difficulty-backdrop"
        className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dialog panel */}
        <motion.div
          key="difficulty-panel"
          className="w-full max-w-md mx-4 bg-layer-2-light dark:bg-layer-2-dark rounded-2xl shadow-2xl p-6 space-y-5"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold app-heading">{heading}</h2>
            <p className="text-sm app-muted mt-1">{subheading}</p>
          </div>

          {/* Radio options */}
          <div className="space-y-2">
            {OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={[
                  'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                  selected === opt.value
                    ? 'bg-layer-3-light dark:bg-layer-3-dark ring-2 ring-blue-500'
                    : 'hover:bg-layer-3-light/60 dark:hover:bg-layer-3-dark/60',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="mt-0.5 accent-blue-500 shrink-0"
                />
                <div className="min-w-0">
                  <span className={`font-semibold ${opt.colour}`}>{opt.label}</span>
                  <p className="text-xs app-muted mt-0.5 leading-snug">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Confirm */}
          <motion.button
            type="button"
            onClick={() => onConfirm(selected)}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary w-full py-3 text-base font-semibold"
          >
            {confirmLabel}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DifficultyDialog;
