/**
 * ChatInputSection — bottom bar of ChatPage.
 *
 * Switches between two mutually exclusive states:
 *  - Won  → VictoryBar (score submission flow)
 *  - Active → MessageInputBox (normal chat input)
 *
 * Rendered inside a `shrink-0` wrapper so it never flexes or scrolls away.
 */
import React from 'react';
import VictoryBar from './VictoryBar';
import MessageInputBox from './MessageInputBox';

export interface ChatInputSectionProps {
  // ── Shared ──────────────────────────────────────────────────────────────────
  isWon: boolean;
  sessionTokens: number;

  // ── VictoryBar (isWon = true) ────────────────────────────────────────────────
  targetWord: string;
  sessionId: string | null;
  wonRank: number | null;
  onRequestDeclineConfirm: (cb: () => void) => void;
  onRequestResetConfirm: (cb: () => void) => void;
  onScoreSubmitted: (entryId: number | null) => void;
  /** True once the player has submitted their score — locks the bar to a disabled input view. */
  scoreSubmitted: boolean;

  // ── MessageInputBox (isWon = false) ──────────────────────────────────────────
  inputText: string;
  inputTokens: number;
  isLoading: boolean;
  hasMessages: boolean;
  potentialPosition: number | null;
  onInputChange: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
}

const ChatInputSection: React.FC<ChatInputSectionProps> = (props) => {
  const {
    isWon,
    sessionTokens,
    targetWord,
    sessionId,
    wonRank,
    onRequestDeclineConfirm,
    onRequestResetConfirm,
    onScoreSubmitted,
    scoreSubmitted,
    inputText,
    inputTokens,
    isLoading,
    hasMessages,
    potentialPosition,
    onInputChange,
    onSubmit,
    onReset,
  } = props;

  return (
    <div className="shrink-0">
      {isWon && !scoreSubmitted ? (
        <VictoryBar
          targetWord={targetWord}
          sessionId={sessionId ?? ''}
          sessionTokens={sessionTokens}
          wonRank={wonRank ?? 999}
          onRequestDeclineConfirm={onRequestDeclineConfirm}
          onRequestResetConfirm={onRequestResetConfirm}
          onScoreSubmitted={onScoreSubmitted}
        />
      ) : (
        <MessageInputBox
          inputText={inputText}
          inputTokens={inputTokens}
          sessionTokens={sessionTokens}
          isLoading={isLoading}
          hasMessages={hasMessages}
          potentialPosition={potentialPosition ?? 0}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onReset={onReset}
          isGameOver={isWon && scoreSubmitted}
        />
      )}
    </div>
  );
};

export default ChatInputSection;
