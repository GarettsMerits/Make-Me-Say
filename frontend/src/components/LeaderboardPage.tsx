/**
 * Leaderboard page  Edisplays top scores and aggregate statistics fetched
 * from the backend API, with per-difficulty filtering.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  fetchLeaderboard,
  fetchLeaderboardStats,
  type LeaderboardEntry,
  type LeaderboardStats,
  type Difficulty,
} from '../utils/api';
import { useUIStore } from '../store';
import LeaderboardMessage from './leaderboard/LeaderboardMessage';

// ─── Difficulty tab config ────────────────────────────────────────────────────

interface DifficultyTab {
  value: Difficulty | 'all';
  label: string;
  colour: string;
}

const TABS: DifficultyTab[] = [
  { value: 'all',       label: 'All',       colour: 'text-gray-500 dark:text-gray-400' },
  { value: 'easy',      label: 'Easy',      colour: 'text-green-500 dark:text-green-400' },
  { value: 'normal',    label: 'Normal',    colour: 'text-blue-500 dark:text-blue-400' },
  { value: 'hard',      label: 'Hard',      colour: 'text-orange-500 dark:text-orange-400' },
  { value: 'nightmare', label: 'Nightmare', colour: 'text-red-500 dark:text-red-400' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function medal(rank: number): string {
  if (rank === 1) return '\uD83E\uDD47';
  if (rank === 2) return '\uD83E\uDD48';
  if (rank === 3) return '\uD83E\uDD49';
  return '';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-2 animate-pulse">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-14 card-inner p-0 rounded-lg" />
    ))}
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center py-8 app-muted">
    <p className="text-4xl mb-3">📭</p>
    <p>{message}</p>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const LeaderboardPage: React.FC = () => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([]);
  const [stats,   setStats]     = useState<LeaderboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  const { pendingHighlightId, setPendingHighlightId } = useUIStore();
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadData() {
      try {
        const difficulty = selectedDifficulty === 'all' ? undefined : selectedDifficulty;
        const [leaderboardResult, statsResult] = await Promise.all([
          fetchLeaderboard(20, difficulty),
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
  }, [selectedDifficulty]);

  useEffect(() => {
    if (!pendingHighlightId || isLoading) return;
    const el = rowRefs.current.get(pendingHighlightId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setPendingHighlightId(null), 3000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHighlightId, isLoading, entries]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="card">
          <h2 className="app-heading mb-1">🏆 Leaderboard</h2>
          <p className="text-sm app-muted">
            Ranked by lowest token count — the fewer tokens you used, the better!
          </p>
        </div>

        {/* ── Difficulty tabs ── */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedDifficulty(tab.value)}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                selectedDifficulty === tab.value
                  ? `bg-layer-3-light dark:bg-layer-3-dark ring-2 ring-blue-500 ${tab.colour}`
                  : `bg-layer-2-light dark:bg-layer-2-dark ${tab.colour} hover:bg-layer-3-light/70 dark:hover:bg-layer-3-dark/70`,
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Stats strip ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Games Played', value: stats.totalGames },
              { label: 'Avg Tokens',   value: stats.averageTokens },
              { label: 'Best Score',   value: stats.bestScore },
              { label: 'Worst Score',  value: stats.worstScore },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-layer-2-light dark:bg-layer-2-dark rounded-lg p-4 text-center shadow-sm"
              >
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Rankings ── */}
        <div className="card">
          <h3 className="app-label text-lg mb-4">Top Scores</h3>

          {isLoading && <LoadingSkeleton />}
          {error && <EmptyState message={error} />}
          {!isLoading && !error && entries.length === 0 && (
            <EmptyState message="No scores yet for this difficulty — be the first to win!" />
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
                    className={[
                      'grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-start px-3 py-2 rounded-lg transition-colors duration-500',
                      isHighlighted
                        ? 'bg-layer-3-light dark:bg-white/10 ring-2 ring-blue-400 dark:ring-blue-500'
                        : rank <= 3
                          ? 'bg-layer-3-light dark:bg-layer-3-dark font-medium'
                          : 'hover:bg-layer-3-light/50 dark:hover:bg-layer-3-dark/50',
                    ].join(' ')}
                  >
                    {/* Rank */}
                    <span className="text-sm text-gray-600 dark:text-gray-300 pt-0.5">
                      {medal(rank) || `${rank}`}
                    </span>

                    {/* Player name + target word + victory message */}
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-gray-800 dark:text-gray-100 truncate">{entry.player_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium">"{entry.target_word}"</span>
                        {selectedDifficulty === 'all' && (
                          <span className="ml-1.5 opacity-60 capitalize">{entry.difficulty}</span>
                        )}
                      </p>
                      {entry.llm_victory_message && (
                        <LeaderboardMessage
                          message={entry.llm_victory_message}
                          targetWord={entry.target_word}
                        />
                      )}
                    </div>

                    {/* Token count */}
                    <span className="text-right text-gray-800 dark:text-gray-100 tabular-nums pt-0.5">
                      {entry.token_count}
                    </span>

                    {/* Date + time */}
                    <div className="text-right hidden sm:flex flex-col items-end pt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(entry.completed_at)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {formatTime(entry.completed_at)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default LeaderboardPage;
