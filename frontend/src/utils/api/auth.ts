/**
 * Auth API — passphrase verification.
 *
 * NOTE: verifyPassphrase intentionally bypasses apiClient.fetch so it can
 * post the passphrase in the request body *before* the client has stored it.
 * Once the server confirms it is valid, the client is updated.
 */
import { apiClient } from './client';

export async function verifyPassphrase(passphrase: string): Promise<void> {
  const response = await window.fetch(`${apiClient.baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error('Invalid passphrase');
  }

  // Store for all subsequent authenticated requests
  apiClient.setPassphrase(passphrase);
}
