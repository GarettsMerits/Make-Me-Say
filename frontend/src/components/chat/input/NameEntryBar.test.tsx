import React from 'react';
import { render, screen } from '@testing-library/react';
import NameEntryBar from './NameEntryBar';

describe('NameEntryBar', () => {
  it('keeps the confirm and cancel controls square', () => {
    render(
      <NameEntryBar
        targetWord="cat"
        sessionTokens={12}
        wonRank={4}
        rankUnavailable={false}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTitle('Submit score')).toHaveClass('size-12');
    expect(screen.getByTitle('Cancel')).toHaveClass('size-12');
  });
});
