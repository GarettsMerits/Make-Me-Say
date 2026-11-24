/**
 * MessageTextarea component
 * Text input area with auto-focus, keyboard shortcuts, and token counter overlay.
 * 
 * SEPARATION OF CONCERNS:
 * - Handles text input state and interactions
 * - Manages keyboard shortcuts (Enter to submit, Shift+Enter for newline)
 * - Auto-focuses when enabled
 * - Displays token count overlay
 */
import React, { useRef, useEffect } from 'react';
import { formatTokenCount } from '../../../utils/tokenCounter';
import { INPUT_BOX } from '../../../styles/chatLayout';

interface MessageTextareaProps {
  value: string;
  tokenCount: number;
  isDisabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * MessageTextarea - the main text input control
 * 
 * COMPONENT RESPONSIBILITY:
 * - Render textarea with proper styling
 * - Auto-focus when enabled after loading
 * - Handle Enter key for submission
 * - Display token count overlay in corner
 */
const MessageTextarea: React.FC<MessageTextareaProps> = ({
  value,
  tokenCount,
  isDisabled,
  onChange,
  onSubmit,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Auto-focus when component becomes enabled
   */
  useEffect(() => {
    if (!isDisabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isDisabled]);

  /**
   * Handle keyboard shortcuts
   * 
   * SHORTCUTS:
   * - Enter: Submit message
   * - Shift+Enter: New line
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message... (Shift+Enter for new line)"
        disabled={isDisabled}
        className="app-textarea pb-8"
        rows={3}
        style={{ height: INPUT_BOX.textareaHeightPx }}
      />
      
      {/* Token counter overlay - positioned in bottom-left corner */}
      <div className="absolute bottom-2 left-4 text-xs app-muted">
        {formatTokenCount(tokenCount)}
      </div>
    </div>
  );
};

export default MessageTextarea;
