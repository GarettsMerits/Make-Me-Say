/**
 * Custom hook for managing message input state and token counting
 * 
 * SEPARATION OF CONCERNS:
 * - Handles input text state
 * - Calculates token counts in real-time
 * - Manages input submission flow
 * - Provides calculated leaderboard position
 * 
 * BENEFITS:
 * - Input logic isolated from chat logic
 * - Easy to add features (autocomplete, mentions, etc.)
 * - Token counting side effect encapsulated
 */
import { useState, useMemo } from 'react';
import { useGameStore } from '../store';
import { estimateTokenCount } from '../utils/tokenCounter';

/**
 * Hook for managing message input and token estimation
 *
 * REACTIVE TOKEN COUNTING:
 * - inputTokens is derived via useMemo — no extra state, no extra render cycle
 * - potentialPosition is also memoised so it only recomputes when its inputs change
 */
export const useMessageInput = () => {
  const [inputText, setInputText] = useState('');

  const { sessionTokens } = useGameStore();

  /**
   * Synchronously derived token estimate.
   * useMemo avoids the two-step setState→re-render cycle that useEffect would cause
   * — the value is ready in the same render that changed inputText.
   */
  const inputTokens = useMemo(
    () => estimateTokenCount(inputText),
    [inputText]
  );

  /**
   * Potential leaderboard position, recomputed only when the token totals change.
   *
   * TODO: Replace the stub formula with a real call to /api/leaderboard/rank/:tokenCount
   */
  const potentialPosition = useMemo(
    () => Math.max(1, Math.floor((sessionTokens + inputTokens) / 10)),
    [sessionTokens, inputTokens]
  );

  /**
   * Submit the current input
   * 
   * FLOW:
   * 1. Call the provided onSubmit handler with current text
   * 2. Clear the input field
   * 3. Token count resets automatically via useEffect
   */
  const submitInput = (onSubmit: (text: string) => void) => {
    if (!inputText.trim()) return;
    
    onSubmit(inputText);
    setInputText(''); // Clear input after submission
  };

  /**
   * Clear input (called after reset)
   */
  const clearInput = () => {
    setInputText('');
  };

  return {
    // State
    inputText,
    inputTokens,
    sessionTokens,
    potentialPosition,
    
    // Actions
    setInputText,
    submitInput,
    clearInput,
  };
};
