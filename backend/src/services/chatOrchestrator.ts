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
import { streamChatCompletion, countTokens, type ChatMessage } from './llm.js';
import { persistExchange, fetchRankContext, type StoredMessage, type SessionRow } from './sessionService.js';

// ─── SSE helpers ──────────────────────────────────────────────────────────────

/** Write a named SSE event with a JSON payload. */
function sseWrite(res: Response, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Target-word detection ────────────────────────────────────────────────────

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function didLlmSayWord(response: string, targetWord: string): boolean {
  return new RegExp(`\\b${escapeRegExp(targetWord)}\\b`, 'i').test(response);
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
): Promise<string> {
  const cheatMode = resolveCheatMode(userMessage);
  let llmResponse = '';

  for await (const chunk of streamChatCompletion({
    targetWord,
    messages: llmMessages,
    maxTokens: 500,
    temperature: 0.7,
    cheatMode,
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
  totalTokens: number,
): Promise<void> {
  const lossHistory: ChatMessage[] = [
    ...llmMessages,
    { role: 'assistant', content: llmResponse },
  ];

  const { rank: lossRank, total: lossTotalEntries } = await fetchRankContext(totalTokens);

  let lossResponse = '';
  try {
    for await (const chunk of streamChatCompletion({
      targetWord,
      messages:        lossHistory,
      maxTokens:       300,
      temperature:     0.9,
      lossMode:        true,
      lossTokenCount:  totalTokens,
      lossRank,
      lossTotalEntries,
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
  storedMessages: StoredMessage[];
  llmMessages: ChatMessage[];
  userMessage: string;
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
  const { sessionId, targetWord, sessionData, storedMessages, llmMessages, userMessage } = input;

  // 1. Stream main response
  const llmResponse = await streamMainTurn(res, targetWord, llmMessages, userMessage);

  // 2. Persist
  const userTokens  = countTokens(userMessage);
  const llmTokens   = countTokens(llmResponse);
  const gameOver    = didLlmSayWord(llmResponse, targetWord);

  const totalTokens = await persistExchange(
    sessionId,
    targetWord,
    sessionData,
    storedMessages,
    userMessage,
    userTokens,
    llmResponse,
    llmTokens,
    gameOver,
  );

  // 3. Done event
  sseWrite(res, 'done', { sessionId, tokenCount: llmTokens, totalTokens, gameOver, targetWordDetected: gameOver });

  // 4. Loss acknowledgement
  if (gameOver) {
    await streamLossTurn(res, targetWord, llmMessages, llmResponse, totalTokens);
  }
}
