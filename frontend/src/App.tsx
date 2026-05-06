import React, { useState, useEffect } from 'react';
import PassphraseGate from './components/PassphraseGate';
import MainApplication from './components/MainApplication';
import { setPassphrase, clearPassphrase } from './utils/api';
import './App.css';

// sessionStorage keys
const SESSION_AUTHENTICATED_KEY = 'authenticated';
const SESSION_PASSPHRASE_KEY = 'passphrase';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /**
   * On mount, check whether the user was already authenticated in this browser
   * session. If so, restore the passphrase into the api module so that
   * subsequent API calls include the correct x-passphrase header.
   *
   * Without this, a page refresh would clear the module-level passphrase in
   * api.ts while sessionStorage still reported authenticated=true, causing
   * every API call to silently 401.
   */
  useEffect(() => {
    const authenticated = sessionStorage.getItem(SESSION_AUTHENTICATED_KEY);
    const storedPassphrase = sessionStorage.getItem(SESSION_PASSPHRASE_KEY);

    if (authenticated === 'true' && storedPassphrase) {
      setPassphrase(storedPassphrase);
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuthenticated = (passphrase: string) => {
    // Persist both the flag and the passphrase so a refresh can restore state
    sessionStorage.setItem(SESSION_AUTHENTICATED_KEY, 'true');
    sessionStorage.setItem(SESSION_PASSPHRASE_KEY, passphrase);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearPassphrase();
    sessionStorage.removeItem(SESSION_AUTHENTICATED_KEY);
    sessionStorage.removeItem(SESSION_PASSPHRASE_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <PassphraseGate onAuthenticated={handleAuthenticated} />;
  }

  return <MainApplication onLogout={handleLogout} />;
}

export default App;
