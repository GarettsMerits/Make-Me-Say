/**
 * Paints a word the server already named as a win.
 * It does not decide whether a round was won.
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
