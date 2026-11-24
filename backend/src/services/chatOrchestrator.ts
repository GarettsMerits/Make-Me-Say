/**
 * Chat orchestrator
 *
 * Coordinates the two streaming pipelines that make up one game turn:
 *   1. Main turn  — stream the LLM's response to the player's message
 *   2. Loss turn  — if the LLM said the target word, stream its loss
 *                   acknowledgement using the loss prompt
 *
 * This module knows about SSE and streaming but NOT about HTTP request/
 * response lifecycle — that stays in the route.
 */
import type { Response } from 'express';
import { InMemoryLeaderboard } from '../domain/InMemoryLeaderboard.js';
import { roundForTranscript } from '../domain/Round.js';
import { countTokens, streamChatCompletion, type ChatMessage } from './llm.js';
import { getRank } from './leaderboardService.js';
import type { ScoredMessage } from '../domain/PlayerScore.js';
import { persistExchange, type SessionRow } from './sessionService.js';
import type { Difficulty } from '../types.js';

// ─── SSE helpers ──────────────────────────────────────────────────────────────

/** Write a named SSE event with a JSON payload. */
function sseWrite(res: Response, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Cheat-mode config ────────────────────────────────────────────────────────

/** Read lazily so dotenv has already run before these values are consumed. */
function getCheatConfig(): { enabled: boolean; trigger: string } {
  return {
    enabled: (process.env.ENABLE_CHEAT_MODE ?? '').toLowerCase() === 'true',
    trigger: (process.env.CHEAT_TRIGGER ?? 'philliburton').toLowerCase(),
  };
}
let _cheatLogged = false;

function resolveCheatMode(message: string): boolean {
  const { enabled, trigger } = getCheatConfig();
  if (enabled && !_cheatLogged) {
    console.warn(`[dev] Cheat mode ENABLED — trigger: "${trigger}"`);
    _cheatLogged = true;
  }
  return enabled && message.toLowerCase().includes(trigger);
}

// ─── Main turn ────────────────────────────────────────────────────────────────

/**
 * Stream the LLM's reply to the player's message.
 * Returns the full accumulated response text, or throws on stream error.
 */
async function streamMainTurn(
  res: Response,
  targetWord: string,
  llmMessages: ChatMessage[],
  userMessage: string,
  difficulty: Difficulty,
): Promise<string> {
  const cheatMode = resolveCheatMode(userMessage);
  let llmResponse = '';

  for await (const chunk of streamChatCompletion({
    targetWord,
    messages: llmMessages,
    maxTokens: 500,
    temperature: 0.7,
    cheatMode,
    difficulty,
  })) {
    llmResponse += chunk;
    sseWrite(res, 'chunk', { text: chunk });
  }

  return llmResponse;
}

// ─── Loss turn ────────────────────────────────────────────────────────────────

/**
 * Stream the LLM's loss acknowledgement after the player wins.
 * Non-fatal: failures are swallowed so the win is never blocked.
 */
async function streamLossTurn(
  res: Response,
  targetWord: string,
  llmMessages: ChatMessage[],
  llmResponse: string,
  playerTokens: number,
  difficulty: Difficulty,
): Promise<void> {
  const lossHistory: ChatMessage[] = [
    ...llmMessages,
    { role: 'assistant', content: llmResponse },
    // Explicit narration injected as a user turn so the LLM cannot misattribute
    // the loss to anything other than its own previous response.
    {
      role: 'user',
      content:
        `[GAME OVER — Word Detection System]: YOUR previous "assistant" response above ` +
        `contained the forbidden word "${targetWord}". It was found in YOUR message, not the user's. ` +
        `You have lost. Now acknowledge your defeat.`,
    },
  ];

  let lossRank = 1;
  let lossTotalEntries = 1;
  try {
    const ranked = await getRank(playerTokens, difficulty);
    lossRank = ranked.rank;
    lossTotalEntries = Math.max(ranked.total, 1);
  } catch (err) {
    console.warn('Could not load loss-prompt rank:', err);
  }

  let lossResponse = '';
  try {
    for await (const chunk of streamChatCompletion({
      targetWord,
      messages:        lossHistory,
      maxTokens:       300,
      temperature:     0.9,
      lossMode:        true,
      lossTokenCount:  playerTokens,
      lossRank,
      lossTotalEntries,
      difficulty,
    })) {
      lossResponse += chunk;
      sseWrite(res, 'loss-chunk', { text: chunk });
    }
  } catch {
    // Loss stream failure is non-fatal — the win is already recorded
  }

  sseWrite(res, 'loss-done', { text: lossResponse });
}

// ─── Public orchestration entry point ────────────────────────────────────────

export interface TurnInput {
  sessionId: string;
  targetWord: string;
  sessionData: SessionRow | null;
  storedMessages: ScoredMessage[];
  llmMessages: ChatMessage[];
  userMessage: string;
  difficulty: Difficulty;
}

/**
 * Run one complete game turn:
 *   1. Stream the main LLM response (emitting `chunk` SSE events)
 *   2. Persist the exchange to the database
 *   3. Emit the `done` SSE event
 *   4. If the player won, stream the loss acknowledgement and emit `loss-done`
 *
 * Throws on main-stream failure (caller should emit an `error` event).
 */
export async function runTurn(res: Response, input: TurnInput): Promise<void> {
  const { sessionId, targetWord, sessionData, storedMessages, llmMessages, userMessage, difficulty } = input;

  // 1. Stream main response
  const llmResponse = await streamMainTurn(res, targetWord, llmMessages, userMessage, difficulty);

  // 2. Persist
  const userTokens = countTokens(userMessage);
  const llmTokens = countTokens(llmResponse);
  const round = roundForTranscript({
    targetWord,
    difficulty,
    leaderboard: new InMemoryLeaderboard(),
    countTokens,
    messages: [
      ...storedMessages,
      { sender: 'user', text: userMessage, tokenCount: userTokens },
      { sender: 'llm', text: llmResponse, tokenCount: llmTokens },
    ],
  });
  // The winning reply is this one only when this reply is what locked the score.
  const gameOver = round.winningReply() === llmResponse;
  const playerTokens = round.figure();

  const totalTokens = await persistExchange(
    sessionId,
    targetWord,
    sessionData,
    storedMessages,
    userMessage,
    userTokens,
    llmResponse,
    llmTokens,
    // A win locks the score and opens the win flow. It does not end the round.
    false,
    difficulty,
  );

  // 3. Done event
  sseWrite(res, 'done', {
    sessionId,
    tokenCount: llmTokens,
    userTokenCount: userTokens,
    totalTokens,
    playerTokens,
    gameOver,
    targetWordDetected: gameOver,
    ...(gameOver ? { llmVictoryMessage: llmResponse } : {}),
  });

  // 4. Loss acknowledgement
  if (gameOver) {
    await streamLossTurn(res, targetWord, llmMessages, llmResponse, playerTokens, difficulty);
  }
}
