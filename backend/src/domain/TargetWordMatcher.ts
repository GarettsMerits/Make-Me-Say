/**
 * Whole-word, case-insensitive match for a target word.
 * The same rule decides a win, which bubble animates, and which
 * leaderboard excerpt is bold.
 */
export class TargetWordMatcher {
  private readonly source: string;
  private readonly normalized: string;

  constructor(targetWord: string) {
    this.normalized = targetWord.toLowerCase();
    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.source = `\\b${escaped}\\b`;
  }

  appearsIn(text: string): boolean {
    if (!this.normalized) return false;
    return new RegExp(this.source, 'i').test(text);
  }

  /** Split text into plain runs and whole-word matches, preserving order. */
  split(text: string): Array<{ text: string; isMatch: boolean }> {
    if (!this.normalized) return text ? [{ text, isMatch: false }] : [];
    const parts = text.split(new RegExp(`(${this.source})`, 'gi'));
    return parts
      .filter((part) => part !== '')
      .map((part) => ({
        text: part,
        isMatch: part.toLowerCase() === this.normalized,
      }));
  }
}
