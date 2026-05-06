/**
 * SessionStats component
 * Displays session token total and potential leaderboard position.
 */
import React from 'react';
import { formatTokenCount } from '../../../utils/tokenCounter';

interface SessionStatsProps {
  sessionTokens: number;
  potentialPosition: number;
}

/**
 * SessionStats - displays game progress metrics
 * 
 * COMPONENT RESPONSIBILITY:
 * - Show total tokens used in session
 * - Show potential leaderboard position
 * - Responsive text styling for dark mode
 */
const SessionStats: React.FC<SessionStatsProps> = ({ 
  sessionTokens, 
  potentialPosition 
}) => {
  return (
    <div className="flex justify-between items-center mb-2 text-sm app-muted">
      <div>
        Session total: <span className="font-medium app-muted-bright">{formatTokenCount(sessionTokens)}</span>
      </div>
      <div>
        Potential position: <span className="font-medium app-muted-bright">#{potentialPosition}</span>
      </div>
    </div>
  );
};

export default SessionStats;
