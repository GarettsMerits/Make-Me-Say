/**
 * BottomBar — the entire bottom section of the chat interface.
 *
 * Internally drives all state via useBottomBar; ChatPage only needs to supply
 * the two external callbacks it cannot own itself (onSubmit, onReset).
 *
 * STATE MACHINE:
 *
 *  Active game (isWon = false):
 *    Normal input  — live textarea + action buttons
 *
 *  After a commit (isWon && scoreSubmitted):
 *    The round can be read and reset. Sending and scoring are closed.
 *
 *  Won, score not yet submitted (isWon && !scoreSubmitted):
 *    'prompt'   → PromptPanel  — congrats + "Submit" / "No thanks"
 *    'enter'    → NameEntryBar — display-name input + submission
 *    'declined' → DeclinedPanel — locked; Reset is the only live control
 *
 * DIALOG POSITIONING:
 *  ConfirmDialog uses `absolute inset-0`. Because React fragments are
 *  DOM-transparent, the dialog elements are direct DOM children of
 *  ChatPage's `absolute inset-0` root — covering the full chat area —
 *  even though they're declared inside this component's JSX.
 *  No portals or CSS changes are required.
 */
import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { getChatContainerClasses, MESSAGE_GRID, BAR_BOTTOM } from '../../styles/chatLayout';
import { useBottomBar } from '../../hooks/useBottomBar';
import SessionStats       from './input/SessionStats';
import MessageTextarea    from './input/MessageTextarea';
import InputActionButtons from './input/InputActionButtons';
import PromptPanel        from './victory/PromptPanel';
import NameEntryBar       from './input/NameEntryBar';
import DeclinedPanel      from './victory/DeclinedPanel';
import ConfirmDialog      from '../ConfirmDialog';

export interface BottomBarProps {
  /** Receives the trimmed message text and initiates the LLM stream. */
  onSubmit: (text: string) => void;
  /** Clears the game session and triggers a fresh target-word fetch. */
  onReset:  () => void;
  /** Restores the composer after the server rejects a turn. */
  rejectedDraft?: { id: number; text: string } | null;
}

const BottomBar: React.FC<BottomBarProps> = ({ onSubmit, onReset, rejectedDraft }) => {
  const {
    inputText, setInputText, inputTokens, submitMessage,
    shownFigure, potentialPosition, scoreLocked, isLoading, isWon, wonRank, rankUnavailable, scoreSubmitted,
    targetWord,
    victoryState, setVictoryState, handleScoreSubmit,
    pendingDialog,
    requestDeclineConfirm, requestResetConfirm,
    confirmPending, cancelPending,
  } = useBottomBar({ onSubmit, onReset, rejectedDraft });

  const showVictory = isWon && !scoreSubmitted;
  const isGameOver  = isWon && scoreSubmitted;

  return (
    <>
      {/* ── Main sticky bar ─────────────────────────────────────────────────── */}
      <div className="bar-bottom shrink-0">
        <div className={getChatContainerClasses('py-4')} style={{ minHeight: BAR_BOTTOM.heightPx }}>

          {showVictory ? (
            /* ── Victory flow ─────────────────────────────────────────────── */
            <AnimatePresence mode="wait">
              {victoryState === 'prompt' ? (
                <PromptPanel
                  key="prompt"
                  sessionTokens={shownFigure}
                  wonRank={wonRank}
                  rankUnavailable={rankUnavailable}
                  onSubmit={() => setVictoryState('enter')}
                  onDecline={requestDeclineConfirm}
                />
              ) : victoryState === 'enter' ? (
                <NameEntryBar
                  key="enter"
                  targetWord={targetWord}
                  sessionTokens={shownFigure}
                  wonRank={wonRank}
                  rankUnavailable={rankUnavailable}
                  onConfirm={handleScoreSubmit}
                  onCancel={() => setVictoryState('prompt')}
                />
              ) : (
                <DeclinedPanel
                  key="declined"
                  score={shownFigure}
                  onReset={requestResetConfirm}
                />
              )}
            </AnimatePresence>

          ) : (
            /* ── Normal / game-over input ─────────────────────────────────── */
            <>
              <SessionStats
                figure={shownFigure}
                locked={scoreLocked}
                potentialPosition={potentialPosition}
                currentRank={scoreSubmitted ? wonRank : null}
              />
              <form
                onSubmit={(e) => { e.preventDefault(); submitMessage(); }}
                className={`${MESSAGE_GRID.gridColumns} ${MESSAGE_GRID.gridGap} grid items-end`}
              >
                <MessageTextarea
                  value={inputText}
                  tokenCount={inputTokens}
                  isDisabled={isLoading || isGameOver}
                  onChange={setInputText}
                  onSubmit={submitMessage}
                />
                <InputActionButtons
                  isLoading={isLoading}
                  hasInput={inputText.trim().length > 0}
                  isGameOver={isGameOver}
                  onReset={onReset}
                  onSubmit={submitMessage}
                />
              </form>
            </>
          )}

        </div>
      </div>

      {/* ── Confirmation dialogs ────────────────────────────────────────────── */}
      <AnimatePresence>
        {pendingDialog?.kind === 'decline' && (
          <ConfirmDialog
            key="decline"
            message="Skip score submission?"
            detail="Your score won't be saved to the leaderboard."
            confirmLabel="Skip"
            cancelLabel="Go back"
            onConfirm={confirmPending}
            onCancel={cancelPending}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default BottomBar;
