/**
 * Token counter utility for estimating token counts in text.
 * Uses a simple approximation: ~4 characters per token (OpenAI standard).
 *
 * NOTE: This is a client-side estimate used for the live input display.
 * The backend uses tiktoken for the authoritative count stored in the session.
 */

export function estimateTokenCount(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  // Simple approximation: 1 token ≈ 4 characters
  // More accurate would be to use actual tokenizer from the LLM API
  const charCount = text.trim().length;
  const estimatedTokens = Math.ceil(charCount / 4);
  
  // Add some tokens for punctuation and spacing
  const wordCount = text.trim().split(/\s+/).length;
  
  return Math.max(estimatedTokens, Math.ceil(wordCount * 0.75));
}

export function formatTokenCount(count: number): string {
  return count === 1 ? '1 token' : `${count} tokens`;
}
