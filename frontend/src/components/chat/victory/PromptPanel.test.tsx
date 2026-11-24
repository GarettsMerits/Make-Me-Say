import React from 'react';
import { render, screen } from '@testing-library/react';
import PromptPanel from './PromptPanel';

const props = {
  sessionTokens: 12,
  onSubmit: () => {},
  onDecline: () => {},
};

describe('PromptPanel', () => {
  it('waits for a place instead of showing a stand-in rank', () => {
    render(<PromptPanel {...props} wonRank={null} rankUnavailable={false} />);
    expect(screen.getByText(/still being counted/i)).toBeInTheDocument();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1st place/)).not.toBeInTheDocument();
  });

  it('shows the place the board returned', () => {
    render(<PromptPanel {...props} wonRank={4} rankUnavailable={false} />);
    expect(screen.getByText(/4th place/)).toBeInTheDocument();
  });

  it('says when the place could not be loaded', () => {
    render(<PromptPanel {...props} wonRank={null} rankUnavailable />);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it('gives submit two thirds of the row and cancel one third', () => {
    render(<PromptPanel {...props} wonRank={4} rankUnavailable={false} />);
    expect(screen.getByRole('button', { name: /submit my score/i })).toHaveClass('col-span-2');
    expect(screen.getByRole('button', { name: /no, thanks/i })).toHaveClass('col-span-1');
  });
});
