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
import { TargetWordMatcher } from '../../utils/TargetWordMatcher';

interface LeaderboardMessageProps {
  message: string;
  targetWord: string;
}

/** Fade the text itself so the mask matches whatever row colour is behind it. */
function edgeMask(left: boolean, right: boolean): string | undefined {
  if (!left && !right) return undefined;
  const start = left ? 'transparent, #000 2.5rem' : '#000 0';
  const end = right ? '#000 calc(100% - 2.5rem), transparent' : '#000 100%';
  return `linear-gradient(to right, ${start}, ${end})`;
}

const LeaderboardMessage: React.FC<LeaderboardMessageProps> = ({ message, targetWord }) => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const contentRef    = useRef<HTMLSpanElement>(null);
  const targetRef     = useRef<HTMLSpanElement>(null);

  const [edges, setEdges] = useState({ left: false, right: false, fits: false });

  const segments = new TargetWordMatcher(targetWord).split(message);

  // After mount (and on resize), position the scroll so the first target-word
  // occurrence is horizontally centered in the container.
  useEffect(() => {
    const container = containerRef.current;
    const content   = contentRef.current;
    const target    = targetRef.current;
    if (!container || !content) return;

    const containerWidth = container.clientWidth;
    const contentWidth   = content.scrollWidth;

    if (!target || contentWidth <= containerWidth) {
      container.scrollLeft = 0;
      const overflows = contentWidth > containerWidth;
      setEdges({ left: false, right: overflows, fits: !overflows });
      return;
    }

    // Calculate scroll position to center the first target-word span
    const targetLeft  = target.offsetLeft;
    const targetWidth = target.offsetWidth;
    const ideal       = targetLeft - containerWidth / 2 + targetWidth / 2;
    const maxScroll   = contentWidth - containerWidth;
    const scrollLeft  = Math.max(0, Math.min(ideal, maxScroll));

    container.scrollLeft = scrollLeft;

    setEdges({
      left: scrollLeft > 1,
      right: scrollLeft < maxScroll - 1,
      fits: false,
    });
  }, [message, targetWord]);

  const mask = edgeMask(edges.left, edges.right);

  return (
    <div className="relative w-full overflow-hidden" style={{ minWidth: 0 }}>
      <div
        ref={containerRef}
        className={`overflow-x-hidden whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 ${edges.fits ? 'text-center' : ''}`}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        <span ref={contentRef}>
          {segments.map((seg, i) => {
            if (!seg.isMatch) {
              return <span key={i}>{seg.text}</span>;
            }
            const isFirst = segments.slice(0, i).every((part) => !part.isMatch);
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
    </div>
  );
};

export default LeaderboardMessage;
