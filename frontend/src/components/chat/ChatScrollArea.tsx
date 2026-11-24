/**
 * ChatScrollArea — the flexible, scrollable messages section of ChatPage.
 *
 * Renders:
 *  - A full-height scrollable container (hidden scrollbar) with messages
 *    pinned to the bottom and growing upward.
 *  - A top gradient that fades content under the UserInstructionPrompt bar.
 *
 * Layout note: the outer div must be `relative overflow-hidden` (provided by
 * ChatPage's `flex-1` region) so the absolute-positioned inner scroll area
 * and gradient overlay are correctly bounded.
 */
import React from 'react';
import { getChatContainerClasses } from '../../styles/chatLayout';
import ChatMessagesContainer from './ChatMessagesContainer';
import type { ChatMessage } from '../../store';

export interface ChatScrollAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isWon: boolean;
  winningMessageId: string | null;
  targetWord: string;
  wonRank: number | null;
  onReroll: () => void;
  isRerolling: boolean;
}

const ChatScrollArea: React.FC<ChatScrollAreaProps> = ({
  messages,
  isLoading,
  isWon,
  winningMessageId,
  targetWord,
  wonRank,
  onReroll,
  isRerolling,
}) => (
  <div className="flex-1 relative overflow-hidden">

    {/* Scrollable viewport — messages stack from the bottom up */}
    <div className="absolute inset-0 overflow-y-auto scrollbar-hide">
      <div className={getChatContainerClasses('h-full flex flex-col justify-end')}>
        <ChatMessagesContainer
          messages={messages}
          isLoading={isLoading}
          winningWord={isWon ? targetWord : undefined}
          winningMessageId={isWon ? winningMessageId : null}
          wonRank={wonRank}
          onReroll={onReroll}
          isRerolling={isRerolling}
        />
      </div>
    </div>

    {/* Fades where the transcript meets the instruction line and the composer */}
    <div className="pointer-events-none absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-layer-1-light dark:from-layer-1-dark to-transparent" />
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-layer-1-light dark:from-layer-1-dark to-transparent" />

  </div>
);

export default ChatScrollArea;
