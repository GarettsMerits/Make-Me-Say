/**
 * ChatPage — root of the game interface.
 *
 * RESPONSIBILITY: pure composition.
 *  - Runs useChatLogic (LLM streaming, win detection, session management)
 *  - Delegates all bottom-bar state (input, dialogs, victory flow) to BottomBar
 *  - No business logic here
 *
 * LAYOUT (absolute inset-0, flex column):
 *  ┌─────────────────────────────┐  ← shrink-0
 *  │  UserInstructionPrompt      │
 *  │  [error banner if any]      │
 *  ├─────────────────────────────┤  ← flex-1 (ChatScrollArea)
 *  │  Scrollable messages        │
 *  ├─────────────────────────────┤  ← shrink-0 (BottomBar)
 *  │  Input / Victory panels     │
 *  └─────────────────────────────┘
 *  ConfirmDialogs are rendered inside BottomBar's fragment and surface as
 *  direct DOM siblings of the bar, covering the full chat area via absolute
 *  positioning relative to this root div.
 */
import React from 'react';
import { useChatLogic } from '../hooks/useChatLogic';
import UserInstructionPrompt from './chat/UserInstructionPrompt';
import ChatScrollArea from './chat/ChatScrollArea';
import BottomBar from './chat/BottomBar';
import DifficultyDialog from './DifficultyDialog';

const ChatPage: React.FC = () => {
  const {
    messages,
    sessionTokens,
    targetWord,
    difficulty,
    showDifficultyDialog,
    handleDifficultyConfirm,
    isLoading,
    isWon,
    wonRank,
    error,
    handleSubmit,
    handleReset,
    handleReroll,
    isRerolling,
  } = useChatLogic();

  return (
    <div className="absolute inset-0 flex flex-col bg-layer-1-light dark:bg-layer-1-dark">

      {/* Difficulty selection dialog — new game welcome or reset chooser */}
      {showDifficultyDialog && (
        <DifficultyDialog
          onConfirm={handleDifficultyConfirm}
          isReset={!!difficulty}
          currentDifficulty={difficulty}
        />
      )}

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
        onReroll={handleReroll}
        isRerolling={isRerolling}
      />

      {/* Bottom bar — input, victory flow, dialogs */}
      <BottomBar
        onSubmit={handleSubmit}
        onReset={handleReset}
      />

    </div>
  );
};

export default ChatPage;
