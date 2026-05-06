/**
 * TypingIndicator component
 * 
 * Animated "typing" bubble with three pulsing dots.
 * Shown while waiting for LLM response to provide visual feedback.
 * 
 * COMPONENT RESPONSIBILITY:
 * - Display animated typing indicator
 * - - Three dots pulse in sequence
 * - - Creates familiar "typing" effect
 * - - Loops infinitely until LLM responds
 * - Match LLM message bubble styling
 * - Provide smooth entrance animation
 */
import React from 'react';
import { motion } from 'framer-motion';

// Defined outside the component so these objects are created once, not on every render.
const DOT_ANIMATE = { scale: [1, 1.2, 1] };
const makeDotTransition = (delay: number) => ({
  duration: 0.6,
  repeat: Infinity,
  delay,
  ease: 'easeInOut' as const,
});
const DOT_TRANSITIONS = [makeDotTransition(0), makeDotTransition(0.2), makeDotTransition(0.4)];

const BUBBLE_INITIAL = { opacity: 0, y: 20 };
const BUBBLE_ANIMATE = { opacity: 1, y: 0 };
const BUBBLE_EXIT   = { opacity: 0, scale: 0.95 };
const BUBBLE_TRANSITION = { duration: 0.2 };

const DOT_CLASS = 'w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full';

/**
 * STYLING:
 * - Uses same bubble style as LLM messages
 * - Rounded corners with bottom-left notch (rounded-bl-sm)
 * - Matches layer-3 background colors
 */
const TypingIndicator: React.FC = () => {
  return (
    <motion.div
      initial={BUBBLE_INITIAL}
      animate={BUBBLE_ANIMATE}
      exit={BUBBLE_EXIT}
      transition={BUBBLE_TRANSITION}
      className="flex justify-start"
    >
      <div className="bg-layer-3-light dark:bg-layer-3-dark text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex space-x-2">
          {DOT_TRANSITIONS.map((transition, i) => (
            <motion.div
              key={i}
              animate={DOT_ANIMATE}
              transition={transition}
              className={DOT_CLASS}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;
