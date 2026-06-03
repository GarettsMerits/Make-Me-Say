/**
 * LeaderboardMessage — displays the LLM victory message in a leaderboard entry.
 *
 * Rules (from Gameplay.md):
 * 1. The message excerpt is contained to a single line.
 * 2. Target word mention(s) are bold.
 * 3. The text is scrolled so the first mention of the target word is centered
 *    in the visible area, with fallbacks for insufficient leading/trailing text.
 * 4. Sides that overflow are faded with a gradient mask.
 */
import React, { useEffect, useRef, useState } from 'react';

interface LeaderboardMessageProps {
  message: string;
  targetWord: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split the message text into segments: plain text and bold (target word) matches.
 */
function segmentMessage(
  message: string,
  targetWord: string,
): Array<{ text: string; bold: boolean }> {
  const regex = new RegExp(`(${escapeRegExp(targetWord)})`, 'gi');
  const parts = message.split(regex);
  const lowerTarget = targetWord.toLowerCase();
  return parts.map((part) => ({
    text: part,
    bold: part.toLowerCase() === lowerTarget,
  }));
}

const LeaderboardMessage: React.FC<LeaderboardMessageProps> = ({ message, targetWord }) => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const contentRef    = useRef<HTMLSpanElement>(null);
  const targetRef     = useRef<HTMLSpanElement>(null);

  const [showLeftFade,  setShowLeftFade]  = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const segments = segmentMessage(message, targetWord);

  // After mount (and on resize), position the scroll so the first target-word
  // occurrence is horizontally centered in the container.
  useEffect(() => {
    const container = containerRef.current;
    const content   = contentRef.current;
    const target    = targetRef.current;
    if (!container || !content || !target) return;

    const containerWidth = container.clientWidth;
    const contentWidth   = content.scrollWidth;

    if (contentWidth <= containerWidth) {
      // Entire message fits — center the whole text block
      container.scrollLeft = 0;
      setShowLeftFade(false);
      setShowRightFade(false);
      return;
    }

    // Calculate scroll position to center the first target-word span
    const targetLeft  = target.offsetLeft;
    const targetWidth = target.offsetWidth;
    const ideal       = targetLeft - containerWidth / 2 + targetWidth / 2;
    const maxScroll   = contentWidth - containerWidth;
    const scrollLeft  = Math.max(0, Math.min(ideal, maxScroll));

    container.scrollLeft = scrollLeft;

    setShowLeftFade(scrollLeft > 0);
    setShowRightFade(scrollLeft < maxScroll);
  }, [message, targetWord]);

  return (
    <div className="relative w-full overflow-hidden" style={{ minWidth: 0 }}>
      {/* Fade mask — left */}
      {showLeftFade && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10"
          style={{
            background: 'linear-gradient(to right, var(--leaderboard-fade-color, rgb(30 30 30)), transparent)',
          }}
        />
      )}

      {/* Scrollable single-line text strip */}
      <div
        ref={containerRef}
        className="overflow-x-hidden whitespace-nowrap text-xs text-gray-500 dark:text-gray-400"
      >
        <span ref={contentRef}>
          {segments.map((seg, i) => {
            if (!seg.bold) {
              return <span key={i}>{seg.text}</span>;
            }
            // Attach targetRef to the very first bold segment
            const isFirst = segments.slice(0, i).every((s) => !s.bold);
            return (
              <strong
                key={i}
                ref={isFirst ? targetRef : undefined}
                className="font-bold text-gray-700 dark:text-gray-200"
              >
                {seg.text}
              </strong>
            );
          })}
        </span>
      </div>

      {/* Fade mask — right */}
      {showRightFade && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10"
          style={{
            background: 'linear-gradient(to left, var(--leaderboard-fade-color, rgb(30 30 30)), transparent)',
          }}
        />
      )}
    </div>
  );
};

export default LeaderboardMessage;
