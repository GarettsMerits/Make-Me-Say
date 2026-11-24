/**
 * Auth API.
 *
 * verify posts the passphrase once. The server answers with an HttpOnly cookie.
 * Later calls rely on that cookie via credentials: 'include'.
 */
import { apiClient } from './client';

export async function verifyPassphrase(passphrase: string): Promise<void> {
  const response = await window.fetch(`${apiClient.baseUrl}/api/auth/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error('Invalid passphrase');
  }
}

/** 200 when the access cookie is still valid for this month. */
export async function checkSession(): Promise<void> {
  const response = await window.fetch(`${apiClient.baseUrl}/api/auth/me`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Not signed in');
  }
}

export async function logout(): Promise<void> {
  await window.fetch(`${apiClient.baseUrl}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
