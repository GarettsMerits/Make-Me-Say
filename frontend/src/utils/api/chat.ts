/**
 * Chat API — streaming LLM responses via Server-Sent Events (SSE).
 *
 * FLOW:
 *  1. POST /api/chat opens an SSE stream.
 *  2. Server emits: meta → (n × chunk) → done  |  error
 *  3. SseParser buffers raw bytes, splits on double-newline boundaries,
 *     and dispatches typed callbacks for each complete event.
 */
import { apiClient } from './client';
import type { ChatRequest, ChatDonePayload, StreamCallbacks } from './types';

// ─── SSE Parser ───────────────────────────────────────────────────────────────

/**
 * Stateful SSE stream parser.
 *
 * Accepts raw Uint8Array chunks as they arrive from the ReadableStream reader,
 * reassembles them into complete SSE event blocks (separated by `\n\n`), and
 * dispatches the appropriate callback for each recognised event type.
 *
 * Keeping this logic in a class means:
 *  - The internal buffer is safely encapsulated.
 *  - A fresh parser per request avoids any cross-request state leakage.
 *  - The dispatch logic is unit-testable independently of the fetch layer.
 */
class SseParser {
  private buffer = '';
  private readonly decoder = new TextDecoder();

  /**
   * Feed the next raw chunk from the stream into the parser.
   * Any complete SSE events found will immediately fire the relevant callback.
   */
  feed(chunk: Uint8Array, callbacks: StreamCallbacks): void {
    this.buffer += this.decoder.decode(chunk, { stream: true });

    // SSE events are delimited by blank lines (\n\n)
    const events = this.buffer.split('\n\n');
    // Retain the last (possibly incomplete) fragment for the next feed()
    this.buffer = events.pop() ?? '';

    for (const raw of events) {
      if (raw.trim()) this.dispatch(raw, callbacks);
    }
  }

  /** Parse one complete SSE block and invoke the matching callback. */
  private dispatch(
    raw: string,
    { onSessionId, onChunk, onDone, onError, onLossChunk, onLossDone }: StreamCallbacks
  ): void {
    let eventName = 'message';
    let dataLine  = '';

    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      if (line.startsWith('data:'))  dataLine  = line.slice(5).trim();
    }

    if (!dataLine) return;

    try {
      const payload = JSON.parse(dataLine);
      switch (eventName) {
        case 'meta':       onSessionId(payload.sessionId);                     break;
        case 'chunk':      onChunk(payload.text ?? '');                        break;
        case 'done':       onDone(payload as ChatDonePayload);                 break;
        case 'error':      onError(new Error(payload.error ?? 'Stream error')); break;
        case 'loss-chunk': onLossChunk?.(payload.text ?? '');        break;
        case 'loss-done':  onLossDone?.(payload.text ?? '');         break;
      }
    } catch {
      // Malformed JSON in an SSE data line — skip silently
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a user message to the LLM and stream the response from the backend.
 *
 * All outcomes (chunks, completion, errors) are delivered through `callbacks`
 * rather than return values so the caller can drive UI updates incrementally.
 */
export async function sendChatMessage(
  request: ChatRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const { onError } = callbacks;

  // ── Open the stream ──────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await apiClient.stream('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  } catch (err) {
    onError(err instanceof Error ? err : new Error('Network error'));
    return;
  }

  // ── Handle non-2xx before any stream data ────────────────────────────────
  if (!response.ok) {
    try {
      const data = await response.json();
      const detail = data.message ? ` — ${data.message}` : '';
      onError(new Error(`${data.error ?? `HTTP ${response.status}`}${detail}`));
    } catch {
      onError(new Error(`HTTP ${response.status}`));
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError(new Error('No response body'));
    return;
  }

  // ── Read stream chunks ───────────────────────────────────────────────────
  const parser = new SseParser();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(value, callbacks);
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error('Stream read error'));
  } finally {
    reader.releaseLock();
  }
}
