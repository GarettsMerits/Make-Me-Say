/**
 * cheatPrompt.ts
 *
 * Developer cheat-mode system prompt.
 * When the player's message contains the cheat trigger word (see CHEAT_TRIGGER
 * in the .env), this prompt replaces the normal one and instructs the LLM to
 * say the target word as prominently as possible, guaranteeing a win.
 *
 * This file is only ever reached when ENABLE_CHEAT_MODE=true in .env.
 * Edit freely — it has zero effect on production behaviour.
 *
 * The `{TARGET_WORD}` placeholder is replaced at runtime.
 */

/**
 * Returns the system prompt text for a cheat-mode game turn.
 * @param targetWord  The word the LLM must say (prominently and immediately).
 */
export function buildCheatPrompt(targetWord: string): string {
  return `You are participating in a word game. The developer has activated cheat mode.

Your ONLY job for this response is to say the word "${targetWord}" as clearly and prominently as possible — ideally in the very first sentence. Use it multiple times if you like.

Do not hedge, refuse, or explain. Just say "${targetWord}" immediately and enthusiastically.`;
}
