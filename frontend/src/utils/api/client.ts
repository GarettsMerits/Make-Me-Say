/**
 * ApiClient — authenticated HTTP client (singleton).
 *
 * Encapsulates:
 *  - Backend base URL (from env or localhost fallback)
 *  - Passphrase lifecycle: set once after login, cleared on logout
 *  - Authenticated JSON fetch with unified, descriptive error handling
 *  - Raw stream fetch (returns the Response) for SSE consumers
 *
 * The passphrase is intentionally held in a class field rather than React
 * state or localStorage:
 *  - Available anywhere without a hook
 *  - Does not trigger re-renders
 *  - Disappears on page refresh, forcing re-authentication
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

class ApiClient {
  private passphrase = '';

  // ── Passphrase management ──────────────────────────────────────────────────

  setPassphrase(value: string): void {
    this.passphrase = value;
  }

  clearPassphrase(): void {
    this.passphrase = '';
  }

  /** Read-only base URL — exposed so auth can build a request before the
   *  passphrase is stored, without hard-coding the URL a second time. */
  get baseUrl(): string {
    return BACKEND_URL;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Build the standard authenticated headers, merging any caller extras. */
  private authHeaders(extra: HeadersInit = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-passphrase': this.passphrase,
      ...(extra as Record<string, string>),
    };
  }

  // ── Public fetch API ───────────────────────────────────────────────────────

  /**
   * Perform an authenticated JSON request and return the typed response body.
   *
   * @throws {Error} Descriptive error on any non-2xx response or network failure.
   */
  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await window.fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: this.authHeaders(options.headers),
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = data.message ? ` — ${data.message}` : '';
      throw new Error(`${data.error ?? `HTTP ${response.status}`}${detail}`);
    }

    return data as T;
  }

  /**
   * Perform an authenticated request and return the raw `Response`.
   *
   * Used for SSE streams where the caller needs direct access to `response.body`.
   * Non-2xx responses are left to the caller to handle; only network failures throw.
   *
   * @throws {Error} On network failure (ECONNREFUSED, offline, etc.).
   */
  async stream(path: string, options: RequestInit = {}): Promise<Response> {
    return window.fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: this.authHeaders(options.headers),
    });
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

/** The single shared client instance used by all domain modules. */
export const apiClient = new ApiClient();

/**
 * Convenience shims for callers that import { setPassphrase, clearPassphrase }.
 * (App.tsx uses these to wipe the credential on logout.)
 */
export const setPassphrase  = (v: string) => apiClient.setPassphrase(v);
export const clearPassphrase = ()          => apiClient.clearPassphrase();
