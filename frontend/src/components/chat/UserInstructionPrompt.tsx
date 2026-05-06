/**
 * User Instruction Prompt component
 * Displays the target word that the user is trying to make the AI say.
 * Anchored below the Top Ribbon.
 *
 * WIN STATE:
 * - When isWon is true, the prompt switches to a "Dangit! I said …" message
 *   to acknowledge the player's victory.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserInstructionPromptProps {
  targetWord: string;
  isWon?: boolean;
}

const UserInstructionPrompt: React.FC<UserInstructionPromptProps> = ({ targetWord, isWon = false }) => {
  return (
    <div className="bar-top">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <AnimatePresence mode="wait">
          {isWon ? (
            <motion.div
              key="won"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                Dangit! I said{' '}
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  "{targetWord || 'banana'}"
                </span>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                I dare you to make me say{' '}
                <span className="text-xl font-bold text-red-600 dark:text-red-400">
                  "{targetWord || 'banana'}"
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default UserInstructionPrompt;
