/**
 * RerollOverlay component
 *
 * Shown in the chat area when no messages exist yet.
 * Occupies the full available height, with:
 *  - a ghost-opacity reroll button centred in the upper portion
 *  - the "start chatting" instruction pinned at the bottom
 *
 * The overlay disappears the moment a message is added (controlled by the
 * parent — this component is simply not rendered once messages.length > 0).
 */
import React from 'react';
import { motion } from 'framer-motion';

interface RerollOverlayProps {
  /** Called when the user clicks the reroll area. */
  onReroll: () => void;
  /** True while a target-word fetch is in flight — button is disabled. */
  isRerolling: boolean;
}

const RerollOverlay: React.FC<RerollOverlayProps> = ({ onReroll, isRerolling }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex-1 flex flex-col h-full py-8"
  >
    {/* Reroll button — centred in the space above the start-chatting text */}
    <div className="flex-1 flex flex-col items-center justify-center">
      <button
        onClick={onReroll}
        disabled={isRerolling}
        className="flex flex-col items-center gap-4 w-full px-8 py-6
                   text-gray-800/[0.09] dark:text-white/[0.09]
                   hover:text-gray-800/[0.18] dark:hover:text-white/[0.18]
                   active:text-gray-800/25 dark:active:text-white/25
                   transition-colors duration-300 select-none
                   disabled:pointer-events-none
                   focus:outline-none cursor-pointer"
        aria-label="Reroll target word"
      >
        {/* 🔁-style repeat icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-80 h-80 shrink-0"
          aria-hidden="true"
        >
          <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
        </svg>
        <span className="text-base">Click to reroll your target word</span>
      </button>
    </div>

    {/* "Start chatting" instruction — pinned at the bottom */}
    <div className="shrink-0 text-center app-muted">
      <p className="text-lg mb-2">👋 Start chatting to begin!</p>
      <p className="text-sm">Try to make me say the target word...</p>
    </div>
  </motion.div>
);

export default RerollOverlay;
