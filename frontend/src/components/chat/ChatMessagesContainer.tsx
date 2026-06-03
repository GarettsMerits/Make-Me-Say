/**
 * ChatMessagesContainer component
 * 
 * Displays chat messages with proper alignment and animations.
 * Messages appear at the bottom and push upward as new ones arrive.
 * 
 * COMPONENT RESPONSIBILITY:
 * - Render list of chat messages
 * - Show empty state when no messages
 * - Display loading indicator while waiting for LLM response
 * - Auto-scroll to keep latest message visible
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChatMessage as ChatMessageType } from '../../store';
import { MESSAGE_GRID } from '../../styles/chatLayout';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import RerollOverlay from './RerollOverlay';

/**
 * Props interface
 */
interface ChatMessagesContainerProps {
  messages: ChatMessageType[];     // Array of chat messages to display
  isLoading: boolean;               // Whether LLM is currently generating a response
  /** The target word to highlight in the winning LLM message (only when isWon). */
  winningWord?: string;
  /** The rank achieved, forwarded to WinningWord for medal colouring. */
  wonRank?: number;
  /** Called when the user clicks the reroll overlay (only visible with no messages). */
  onReroll?: () => void;
  /** True while the target-word fetch is in flight — disables the reroll button. */
  isRerolling?: boolean;
}

/**
 * ChatMessagesContainer component
 * 
 * FRAMER MOTION:
 * - AnimatePresence: Enables exit animations for removed messages
 * - motion.div: Provides smooth fade-in animations for new elements
 */
const ChatMessagesContainer: React.FC<ChatMessagesContainerProps> = ({ 
  messages, 
  isLoading,
  winningWord,
  wonRank,
  onReroll,
  isRerolling,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Id of the FIRST LLM message that contains the winning word.
   *
   * We search forward (not in reverse) so the effect permanently attaches to
   * the original winning bubble. The loss-acknowledgement message often also
   * mentions the target word ("I said 'X'!"), and without this the highlight
   * would jump to that later message once it starts streaming.
   *
   * useMemo means the id is computed fresh only when messages or winningWord
   * change, but because we take the first match it will resolve on the same
   * message for the lifetime of the session.
   */
  const winningMessageId = useMemo(() => {
    if (!winningWord) return undefined;
    const lw = winningWord.toLowerCase();
    return messages.find(
      (m) => m.sender === 'llm' && m.text.toLowerCase().includes(lw)
    )?.id;
  }, [messages, winningWord]);

  /**
   * Auto-scroll to bottom when new content appears
   * 
   * TRIGGER CONDITIONS:
   * - New message added to messages array
   * - Loading state changes (typing indicator appears/disappears)
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /**
   * Render the messages container
   * 
   * CONDITIONAL RENDERING:
   * - Empty state: Shows welcome message when no messages exist
   * - Message list: Shows all messages with loading indicator when active
   */
  return (
    <>
      {/* ===== EMPTY STATE ===== */}
      {messages.length === 0 ? (
        onReroll ? <RerollOverlay onReroll={onReroll} isRerolling={isRerolling ?? false} /> : null
        
      ) : (
        /* ===== MESSAGE LIST ===== */
        <div className="space-y-4 pb-4">
          
          {/* 
            Message list with animations
            
            FRAMER MOTION AnimatePresence:
            - Handles enter/exit animations for messages
            - Each message gets unique key for tracking
          */}
          <AnimatePresence>
            {messages.map((message) => {
              // Skip the empty LLM placeholder added before streaming begins —
              // the TypingIndicator below covers that state visually.
              if (message.sender === 'llm' && message.text === '') return null;
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  winningWord={message.id === winningMessageId ? winningWord : undefined}
                  wonRank={wonRank}
                />
              );
            })}
          </AnimatePresence>
          
          
          {/* ===== LOADING INDICATOR ===== */}
          {/* 
            Typing indicator - shown while LLM generates response
            
            GRID LAYOUT:
            - Uses same grid structure as messages for alignment
            - Left column: TypingIndicator component with animated dots
            - Right column: spacer to match message layout
          */}
          {isLoading && (
            <div className={`grid ${MESSAGE_GRID.gridColumns} ${MESSAGE_GRID.gridGap}`}>
              
              {/* Animated typing bubble component */}
              <TypingIndicator />
              
              {/* Spacer column to match message grid layout */}
              <div style={{ width: MESSAGE_GRID.rightColumnWidthPx }} />
              
            </div>
          )}
          
          
          {/* ===== AUTO-SCROLL ANCHOR ===== */}
          <div ref={messagesEndRef} />
          
        </div>
      )}
    </>
  );
};

export default ChatMessagesContainer;
