/**
 * ChatPage — root of the game interface.
 *
 * RESPONSIBILITY: pure composition.
 *  - Wires hooks to child components
 *  - Delegates layout to ChatScrollArea and ChatInputSection
 *  - Delegates dialog state to useChatDialogs, rendering via ChatDialogs
 *  - Contains NO business logic
 *
 * LAYOUT (absolute inset-0, flex column):
 *  ┌─────────────────────────────┐  ← shrink-0
 *  │  UserInstructionPrompt      │
 *  │  [error banner if any]      │
 *  ├─────────────────────────────┤  ← flex-1 (ChatScrollArea)
 *  │  Scrollable messages        │
 *  ├─────────────────────────────┤  ← shrink-0 (ChatInputSection)
 *  │  VictoryBar | MessageInput  │
 *  └─────────────────────────────┘
 *  ChatDialogs overlaid at root level (covers everything except TopRibbon)
 */

import React from 'react';
import { useChatLogic } from '../hooks/useChatLogic';
import { useMessageInput } from '../hooks/useMessageInput';
import { useChatDialogs } from '../hooks/useChatDialogs';
import { useUIStore, useGameStore } from '../store';
import UserInstructionPrompt from './chat/UserInstructionPrompt';
import ChatScrollArea from './chat/ChatScrollArea';
import ChatInputSection from './chat/ChatInputSection';
import ChatDialogs from './chat/ChatDialogs';

const ChatPage: React.FC = () => {
  const {
    messages,
    sessionTokens,
    targetWord,
    sessionId,
    isLoading,
    isWon,
    wonRank,
    error,
    handleSubmit,
    handleReset,
  } = useChatLogic();

  const { setCurrentPage, setPendingHighlightId } = useUIStore();
  const { scoreSubmitted, setScoreSubmitted } = useGameStore();

  const {
    inputText,
    inputTokens,
    potentialPosition,
    setInputText,
    submitInput,
    clearInput,
  } = useMessageInput();

  const dialogs = useChatDialogs(handleReset, clearInput);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitInput(handleSubmit);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-layer-1-light dark:bg-layer-1-dark">

      {/* Top bar — instruction prompt + optional error banner */}
      <div className="shrink-0">
        <UserInstructionPrompt targetWord={targetWord} isWon={isWon} />
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300 text-center">
            {error}
          </div>
        )}
      </div>

      {/* Scrollable message history */}
      <ChatScrollArea
        messages={messages}
        isLoading={isLoading}
        isWon={isWon}
        targetWord={targetWord}
        wonRank={wonRank}
      />

      {/* Bottom input bar — VictoryBar or MessageInputBox */}
      <ChatInputSection
        isWon={isWon}
        sessionTokens={sessionTokens}
        targetWord={targetWord}
        sessionId={sessionId}
        wonRank={wonRank}
        onRequestDeclineConfirm={dialogs.onRequestDeclineConfirm}
        onRequestResetConfirm={dialogs.onRequestResetConfirm}
        onScoreSubmitted={(entryId) => {
          setScoreSubmitted(true);
          if (entryId !== null) setPendingHighlightId(entryId);
          setCurrentPage('leaderboard');
        }}
        scoreSubmitted={scoreSubmitted}
        inputText={inputText}
        inputTokens={inputTokens}
        isLoading={isLoading}
        hasMessages={messages.length > 0}
        potentialPosition={potentialPosition}
        onInputChange={setInputText}
        onSubmit={onSubmit}
        onReset={dialogs.openResetDialog}
      />

      {/* Confirmation dialogs — rendered at root so overlay spans the full chat area */}
      <ChatDialogs
        resetDialogOpen={dialogs.resetDialogOpen}
        pendingConfirm={dialogs.pendingConfirm}
        onConfirmReset={dialogs.confirmReset}
        onCancelReset={dialogs.cancelReset}
        onConfirmPending={dialogs.confirmPending}
        onCancelPending={dialogs.cancelPending}
      />

    </div>
  );
};

export default ChatPage;
