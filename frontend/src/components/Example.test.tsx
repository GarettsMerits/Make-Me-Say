import React from 'react';
import { render } from '@testing-library/react';
import Example from './Example';

test('renders Example component', () => {
  const { getByText } = render(<Example />);
  const linkElement = getByText(/example/i);
  expect(linkElement).toBeInTheDocument();
});