import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  sessionStorage.clear();
});

test('shows the passphrase gate before the game', () => {
  render(<App />);
  expect(screen.getByPlaceholderText(/enter passphrase/i)).toBeInTheDocument();
});
