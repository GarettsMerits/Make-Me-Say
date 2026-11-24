/**
 * Holds an incomplete line from a chunked stream and returns lines
 * once a newline arrives. Refuses to keep more than `maxPending` characters
 * of a line that never ends.
 */
export class LineBuffer {
  private pending = '';

  constructor(private readonly maxPending: number) {}

  push(chunk: string): string[] {
    this.pending += chunk;
    if (this.pending.length > this.maxPending) {
      this.pending = '';
      throw new Error('line buffer exceeded');
    }
    const lines = this.pending.split('\n');
    this.pending = lines.pop() ?? '';
    return lines;
  }
}
