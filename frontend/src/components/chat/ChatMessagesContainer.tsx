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
import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage as ChatMessageType } from '../../store';
import { MESSAGE_GRID } from '../../styles/chatLayout';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';

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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Id of the last LLM message — this is the one that contains the winning word.
   * Computed once from the message list; changes only when messages change.
   */
  const winningMessageId = winningWord
    ? [...messages].reverse().find(
        (m) => m.sender === 'llm' && m.text.toLowerCase().includes(winningWord.toLowerCase())
      )?.id
    : undefined;

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-end justify-center min-h-full pb-8"
        >
          <div className="text-center app-muted">
            <p className="text-lg mb-2">👋 Start chatting to begin!</p>
            <p className="text-sm">Try to make me say the target word...</p>
          </div>
        </motion.div>
        
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
