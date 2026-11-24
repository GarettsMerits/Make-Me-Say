/**
 * ApiClient — authenticated HTTP client (singleton).
 *
 * The access credential is an HttpOnly cookie set by POST /api/auth/verify.
 * This module never stores the passphrase. Every request uses
 * credentials: 'include' so the browser sends that cookie cross-origin.
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

class ApiClient {
  get baseUrl(): string {
    return BACKEND_URL;
  }

  private headers(extra: HeadersInit = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(extra as Record<string, string>),
    };
  }

  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await window.fetch(`${BACKEND_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: this.headers(options.headers),
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = data.message ? ` — ${data.message}` : '';
      throw new Error(`${data.error ?? `HTTP ${response.status}`}${detail}`);
    }

    return data as T;
  }

  /**
   * Authenticated request that returns the raw Response, for SSE.
   * Non-2xx responses are left to the caller. Network failures throw.
   */
  async stream(path: string, options: RequestInit = {}): Promise<Response> {
    return window.fetch(`${BACKEND_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: this.headers(options.headers),
    });
  }
}

export const apiClient = new ApiClient();
