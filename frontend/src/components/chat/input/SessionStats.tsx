/**
 * The figure for this round. While a message can still be sent it is the
 * token preview. From the win onward it is the locked score.
 */
import React from 'react';
import { formatTokenCount } from '../../../utils/tokenCounter';
import { rankLabel } from '../../../utils/rankHelpers';

interface SessionStatsProps {
  figure: number;
  locked: boolean;
  potentialPosition?: number | null;
  /** The entry's current rank after a commit. Hidden before then. */
  currentRank?: number | null;
}

const SessionStats: React.FC<SessionStatsProps> = ({
  figure,
  locked,
  potentialPosition = null,
  currentRank = null,
}) => {
  return (
    <div className="mb-2 text-sm app-muted">
      {locked ? 'Score' : 'Token preview'}:{' '}
      <span className="font-medium app-muted-bright">{formatTokenCount(figure)}</span>
      {potentialPosition !== null && (
        <span>
          {' '}· Potential position:{' '}
          <span className="font-medium app-muted-bright">{rankLabel(potentialPosition)}</span>
        </span>
      )}
      {currentRank !== null && (
        <span>
          {' '}· Rank:{' '}
          <span className="font-medium app-muted-bright">{rankLabel(currentRank)}</span>
        </span>
      )}
    </div>
  );
};

export default SessionStats;
