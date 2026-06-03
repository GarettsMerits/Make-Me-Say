/**
 * InputActionButtons component
 * Reset and Submit button column that sits to the right of the textarea.
 * 
 * SEPARATION OF CONCERNS:
 * - Handles button layout and sizing
 * - Manages button states (enabled/disabled)
 * - Provides visual feedback with animations
 * - Sizes match textarea height automatically
 */
import React from 'react';
import { motion } from 'framer-motion';
import { INPUT_BOX, MESSAGE_GRID } from '../../../styles/chatLayout';

interface InputActionButtonsProps {
  isLoading: boolean;
  hasMessages: boolean;
  hasInput: boolean;
  /** When true, the send button is disabled but reset remains active. */
  isGameOver?: boolean;
  onReset: () => void;
  onSubmit: () => void;
}

/**
 * InputActionButtons - Reset and Submit buttons
 * 
 * COMPONENT RESPONSIBILITY:
 * - Render two vertically stacked buttons
 * - Match height of textarea
 * - Disable/enable based on state
 * - Animate interactions
 * 
 * BUTTON STATES:
 * - Reset: Disabled when loading or no messages exist
 * - Submit: Disabled when loading or no input text
 */
const InputActionButtons: React.FC<InputActionButtonsProps> = ({
  isLoading,
  hasMessages,
  hasInput,
  isGameOver = false,
  onReset,
  onSubmit,
}) => {
  return (
    <div 
      className="flex flex-col gap-2" 
      style={{ 
        height: INPUT_BOX.textareaHeightPx, 
        width: MESSAGE_GRID.rightColumnWidthPx 
      }}
    >
      {/* 
        Reset button — always clickable so the player can change difficulty
        or start over at any point, even before sending a message.
      */}
      <motion.button
        type="button"
        onClick={onReset}
        whileTap={!isLoading ? { scale: 0.97 } : {}}
        className="flex-1 btn-secondary flex items-center justify-center text-2xl"
        disabled={isLoading}
        title="Reset / change difficulty"
      >
        🔄
      </motion.button>
      
      {/* 
        Submit button - sends message
        
        DISABLED WHEN:
        - Currently loading LLM response
        - No input text entered
        
        VISUAL FEEDBACK:
        - Shows loading indicator (⋯) when processing
        - Shows arrow (→) when ready to submit
      */}
      <motion.button
        type="submit"
        whileTap={!isLoading && !isGameOver && hasInput ? { scale: 0.97 } : {}}
        disabled={isLoading || isGameOver || !hasInput}
        className="flex-1 btn-primary flex items-center justify-center text-3xl"
        title="Send message"
        aria-label="Send message"
      >
        {isLoading ? '⋯' : '→'}
      </motion.button>
    </div>
  );
};

export default InputActionButtons;
