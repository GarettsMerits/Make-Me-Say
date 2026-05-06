/**
 * MessageInputBox component
 * Container for the message input interface at the bottom of the chat.
 */
import React from 'react';
import { getChatContainerClasses, MESSAGE_GRID } from '../../styles/chatLayout';
import SessionStats from './input/SessionStats';
import MessageTextarea from './input/MessageTextarea';
import InputActionButtons from './input/InputActionButtons';

interface MessageInputBoxProps {
  inputText: string;
  inputTokens: number;
  sessionTokens: number;
  isLoading: boolean;
  hasMessages: boolean;
  potentialPosition: number;
  onInputChange: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  /** When true, the textarea and send button are disabled but reset remains active. */
  isGameOver?: boolean;
}

/**
 * MessageInputBox
 * 
 * COMPONENT RESPONSIBILITY:
 * - Layout and composition only
 * - Wire up sub-components with props
 * - Handle form submission coordination
 * - NO rendering logic or state management here
 */
const MessageInputBox: React.FC<MessageInputBoxProps> = ({
  inputText,
  inputTokens,
  sessionTokens,
  isLoading,
  hasMessages,
  potentialPosition,
  onInputChange,
  onSubmit,
  onReset,
  isGameOver = false,
}) => {
  /**
   * Handle form submission — called by the submit button via the form's onSubmit.
   */
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  /**
   * Handle submission triggered by the Enter key inside the textarea.
   * The textarea doesn't live inside a <form>, so we call the parent
   * handler directly rather than dispatching a synthetic form event.
   */
  const handleTextareaSubmit = () => onSubmit({ preventDefault: () => {} } as React.FormEvent);

  /**
   * Render the input interface
   * 
   * LAYOUT STRUCTURE:
   * 1. SessionStats - displays token count and leaderboard position
   * 2. Form with grid layout:
   *    - MessageTextarea (left column, flexible width)
   *    - InputActionButtons (right column, fixed width)
   * 
   * All components use shared layout constants for perfect alignment
   */
  return (
    <div className="bar-bottom">
      <div className={getChatContainerClasses('py-4')}>
        
        {/* Session statistics bar */}
        <SessionStats 
          sessionTokens={sessionTokens}
          potentialPosition={potentialPosition}
        />
        
        {/* Input form with grid layout matching message alignment */}
        <form 
          onSubmit={handleFormSubmit} 
          className={`${MESSAGE_GRID.gridColumns} ${MESSAGE_GRID.gridGap} grid items-end`}
        >
          {/* Text input area with token counter */}
          <MessageTextarea
            value={inputText}
            tokenCount={inputTokens}
            isDisabled={isLoading || isGameOver}
            onChange={onInputChange}
            onSubmit={handleTextareaSubmit}
          />
          
          {/* Action buttons (Reset and Submit) */}
          <InputActionButtons
            isLoading={isLoading}
            hasMessages={hasMessages}
            hasInput={inputText.trim().length > 0}
            isGameOver={isGameOver}
            onReset={onReset}
            onSubmit={handleTextareaSubmit}
          />
        </form>
      </div>
    </div>
  );
};

export default MessageInputBox;
