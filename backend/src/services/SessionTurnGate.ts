/**
 * One in-flight model call per game session.
 *
 * A second request for the same session is refused so it does not read a
 * stale transcript, pay for a second completion, and overwrite the first save.
 * This is process-local. The database update also requires the token total
 * it originally read, so another process cannot clobber a saved turn.
 */
export class SessionTurnGate {
  private readonly busy = new Set<string>();

  /** @returns false when this session already has a turn in flight. */
  tryAcquire(sessionId: string): boolean {
    if (this.busy.has(sessionId)) return false;
    this.busy.add(sessionId);
    return true;
  }

  release(sessionId: string): void {
    this.busy.delete(sessionId);
  }
}

export const sessionTurnGate = new SessionTurnGate();
