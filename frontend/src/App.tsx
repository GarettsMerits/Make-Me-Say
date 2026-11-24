import React, { useState, useEffect } from 'react';
import PassphraseGate from './components/PassphraseGate';
import MainApplication from './components/MainApplication';
import { checkSession, logout } from './utils/api';
import './App.css';

/** Remembers that this tab passed the gate. The secret itself stays in an HttpOnly cookie. */
const SESSION_AUTHENTICATED_KEY = 'authenticated';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(SESSION_AUTHENTICATED_KEY) === 'true',
  );

  useEffect(() => {
    // Older builds stored the passphrase here. Drop it so it cannot linger.
    sessionStorage.removeItem('passphrase');
    if (sessionStorage.getItem(SESSION_AUTHENTICATED_KEY) !== 'true') return;

    let cancelled = false;
    checkSession().catch(() => {
      if (cancelled) return;
      sessionStorage.removeItem(SESSION_AUTHENTICATED_KEY);
      setIsAuthenticated(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleAuthenticated = () => {
    sessionStorage.setItem(SESSION_AUTHENTICATED_KEY, 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    logout().finally(() => {
      sessionStorage.removeItem(SESSION_AUTHENTICATED_KEY);
      sessionStorage.removeItem('passphrase');
      setIsAuthenticated(false);
    });
  };

  if (!isAuthenticated) {
    return <PassphraseGate onAuthenticated={handleAuthenticated} />;
  }

  return <MainApplication onLogout={handleLogout} />;
}

export default App;
