/**
 * Displays an individual chat message bubble with sender-specific styling.
 * 
 * COMPONENT RESPONSIBILITY:
 * - Render message text with appropriate styling
 * - Show token count if available
 * - Align properly with input box using grid layout
 * - Animate entrance and exit
 * 
 * LAYOUT:
 * - Uses CSS Grid matching MessageInputBox structure
 * - User messages: right column, left spacer for margin
 * - LLM messages: left column, right spacer for alignment
 * - This ensures perfect alignment with input box and prevents overflow
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ChatMessage as ChatMessageType } from '../../store';
import { formatTokenCount } from '../../utils/tokenCounter';
import { getMessageGridClasses, MESSAGE_GRID } from '../../styles/chatLayout';
import { useUIStore } from '../../store';
import WinningWord from './WinningWord';

interface ChatMessageProps {
  message: ChatMessageType;
  /**
   * When provided (on the single LLM message that triggered the win), the
   * component will locate this word in the message text and render it as the
   * animated WinningWord instead of plain text.
   */
  winningWord?: string;
  /** The player's achieved leaderboard rank — forwarded to WinningWord for medal colouring. */
  wonRank?: number;
}

/**
 * ChatMessage component
 * 
 * STYLING DIFFERENCES:
 * - User messages: Blue bubble, aligned right, no width limit
 * - LLM messages: Gray bubble, aligned left, max 75% width
 */
const ChatMessage: React.FC<ChatMessageProps> = React.memo(({ message, winningWord, wonRank = 1 }) => {
  const isUser = message.sender === 'user';
  const { isDarkMode } = useUIStore();

  /**
   * Split the message text around the winning word (case-insensitive) so we
   * can render the matched word as <WinningWord> and everything else as plain
   * text. Returns a single-element array with the full text when no match.
   */
  const renderText = () => {
    if (!winningWord || isUser) {
      return <>{message.text}</>;
    }

    // Escape the target word for use in a regex (mirrors backend escapeRegExp)
    const escaped = winningWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = message.text.split(new RegExp(`(${escaped})`, 'i'));

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === winningWord.toLowerCase()
            ? <WinningWord key={i} word={part} rank={wonRank} isDarkMode={isDarkMode} />
            : <React.Fragment key={i}>{part}</React.Fragment>
        )}
      </>
    );
  };

  return (
    // Grid container - uses shared layout from chatLayout.ts
    <div className={getMessageGridClasses('items-start')}>
      
      {/* 
        Left spacer for user messages
        
        ALIGNMENT STRATEGY:
        - User messages need left margin to align with input box
        - Spacer prevents overflow on left side
        - Only shown for user messages (LLM messages don't need left spacer)
      */}
      {isUser && (
        <div 
          style={{ width: MESSAGE_GRID.rightColumnWidthPx }} 
          className="flex-shrink-0" 
          aria-hidden="true"
        />
      )}
      
      {/* 
        Message bubble with animation
        
        FRAMER MOTION ANIMATIONS:
        - initial: Start faded and slightly below with small scale
        - animate: Fade in, move to position, scale to normal
        - exit: Fade out with slight scale down (for removal)
        - transition: 0.3s duration for smooth effect
      */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`rounded-2xl px-4 py-3 whitespace-pre-wrap break-words min-w-0 ${
          isUser
            // User message styling in right column only
            // max-w-full prevents overflow beyond grid column boundary
            // min-w-0 forces respect of grid column constraints
            ? 'justify-self-end bg-blue-600 text-white rounded-br-sm max-w-full'
            // LLM message styling - in left column
            : 'bg-layer-3-light dark:bg-layer-3-dark text-gray-800 dark:text-gray-100 rounded-bl-sm max-w-full'
        }`}
      >

        <p>{renderText()}</p>

        {isUser && message.tokenCount !== undefined && (
          <p className="text-xs mt-1 opacity-70">
            {formatTokenCount(message.tokenCount)}
          </p>
        )}
      </motion.div>

      {/* 
        Right spacer for LLM messages
        
        ALIGNMENT STRATEGY:
        - LLM messages: only use left column, spacer fills right column
        - Spacer width matches input box button column (MESSAGE_GRID.rightColumnWidthPx)
        - This ensures LLM message left edge aligns with input box left edge
        - Only shown for LLM messages (user messages have left spacer instead)
      */}
      {!isUser && (
        <div 
          style={{ width: MESSAGE_GRID.rightColumnWidthPx }} 
          className="flex-shrink-0" 
          aria-hidden="true"
        />
      )}
      
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
