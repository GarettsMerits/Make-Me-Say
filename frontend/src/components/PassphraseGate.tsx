/**
 * Passphrase gate component that handles authentication before allowing
 * access to the main application. Provides a simple password-based entry
 * system with session storage for persistence.
 *
 * Reads `isDarkMode` from the UI store so the user's previously-saved
 * preference is honoured on the login screen before they reach the app.
 */
import React, { useEffect, useState } from 'react';
import { verifyPassphrase } from '../utils/api';
import { useUIStore } from '../store';

interface PassphraseGateProps {
  /** Called with the verified passphrase so the parent can persist it. */
  onAuthenticated: (passphrase: string) => void;
}

const PassphraseGate: React.FC<PassphraseGateProps> = ({ onAuthenticated }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { isDarkMode } = useUIStore();

  // Apply/remove the 'dark' class on <html> so Tailwind dark-mode utilities work
  // before the main application mounts (which does the same thing once logged in).
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await verifyPassphrase(input);
      // Pass the verified passphrase up so App can persist it for refresh recovery
      onAuthenticated(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Enter passphrase"
            />
          </div>

          {error && (
            <div className="text-red-500 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PassphraseGate;