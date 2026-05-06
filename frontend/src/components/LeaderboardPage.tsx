/**
 * Leaderboard page — displays top scores and aggregate statistics fetched
 * from the backend API.
 *
 * DATA FLOW:
 * - On mount: fetch leaderboard entries + stats simultaneously
 * - Show a loading skeleton while waiting
 * - Show an error message if the backend is unreachable
 * - Render a ranked table once data arrives
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  fetchLeaderboard,
  fetchLeaderboardStats,
  type LeaderboardEntry,
  type LeaderboardStats,
} from '../utils/api';
import { useUIStore } from '../store';

// ─── Medal helpers ────────────────────────────────────────────────────────────

/** Returns an emoji medal for the top three ranks, empty string otherwise. */
function medal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

/** Formats an ISO timestamp into a readable local date string. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Displays while the API request is in flight. */
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-2 animate-pulse">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="h-10 card-inner p-0"
      />
    ))}
  </div>
);

/** Displayed when the fetch fails or returns no data. */
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center py-8 app-muted">
    <p className="text-4xl mb-3">📭</p>
    <p>{message}</p>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const LeaderboardPage: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { pendingHighlightId, setPendingHighlightId } = useUIStore();
  /** Map of entry id → ref so we can scroll to the highlighted row. */
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  /**
   * Fetch leaderboard data on mount.
   * Both requests run in parallel via Promise.all for speed.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [leaderboardResult, statsResult] = await Promise.all([
          fetchLeaderboard(20),
          fetchLeaderboardStats(),
        ]);

        if (!cancelled) {
          setEntries(leaderboardResult.leaderboard);
          setStats(statsResult);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load leaderboard. Is the backend running?'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  /**
   * Once entries load AND there is a pending highlight id, scroll to that row
   * and then clear the pending id so it doesn't re-highlight on next visit.
   */
  useEffect(() => {
    if (!pendingHighlightId || isLoading) return;
    const el = rowRefs.current.get(pendingHighlightId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Clear after a short delay so the scroll finishes before the highlight
      // style is removed on a future render
      const timer = setTimeout(() => setPendingHighlightId(null), 3000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHighlightId, isLoading, entries]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="card">
          <h2 className="app-heading mb-1">
            🏆 Leaderboard
          </h2>
          <p className="text-sm app-muted">
            Ranked by lowest token count — the fewer tokens you used, the better!
          </p>
        </div>

        {/* ── Stats strip ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Games Played', value: stats.totalGames },
              { label: 'Avg Tokens', value: stats.averageTokens },
              { label: 'Best Score', value: stats.bestScore },
              { label: 'Worst Score', value: stats.worstScore },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-layer-2-light dark:bg-layer-2-dark rounded-lg p-4 text-center shadow-sm"
              >
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Rankings table ── */}
        <div className="card">
          <h3 className="app-label text-lg mb-4">
            Top Scores
          </h3>

          {isLoading && <LoadingSkeleton />}

          {error && <EmptyState message={error} />}

          {!isLoading && !error && entries.length === 0 && (
            <EmptyState message="No scores yet — be the first to win!" />
          )}

          {!isLoading && !error && entries.length > 0 && (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-[2rem_1fr_auto_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wide app-muted">
                <span>#</span>
                <span>Player</span>
                <span className="text-right">Tokens</span>
                <span className="text-right hidden sm:block">Date</span>
              </div>

              {/* Rows */}
              {entries.map((entry, index) => {
                const rank = index + 1;
                const isHighlighted = entry.id === pendingHighlightId;
                return (
                  <motion.div
                    key={entry.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(entry.id, el);
                      else rowRefs.current.delete(entry.id);
                    }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={`grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-center px-3 py-2 rounded-lg transition-colors duration-500
                      ${isHighlighted
                        ? 'bg-layer-3-light dark:bg-white/10 ring-2 ring-blue-400 dark:ring-blue-500'
                        : rank <= 3
                          ? 'bg-layer-3-light dark:bg-layer-3-dark font-medium'
                          : 'hover:bg-layer-3-light/50 dark:hover:bg-layer-3-dark/50'
                      }`}
                  >
                    {/* Rank */}
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {medal(rank) || `${rank}`}
                    </span>

                    {/* Player name + target word */}
                    <div className="min-w-0">
                      <p className="text-gray-800 dark:text-gray-100 truncate">
                        {entry.player_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        "{entry.target_word}"
                      </p>
                    </div>

                    {/* Token count */}
                    <span className="text-right text-gray-800 dark:text-gray-100 tabular-nums">
                      {entry.token_count}
                    </span>

                    {/* Date */}
                    <span className="text-right text-xs text-gray-500 dark:text-gray-400 hidden sm:block whitespace-nowrap">
                      {formatDate(entry.completed_at)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
};

export default LeaderboardPage;