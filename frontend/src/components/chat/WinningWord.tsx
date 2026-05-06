/**
 * WinningWord component
 *
 * Renders the target word in a visually celebratory way when the player wins:
 *  - Bold text coloured gold / silver / bronze for top-3 ranks, otherwise white
 *  - A continuous wave animation where each letter rises and falls in sequence
 *  - A periodic white colour pulse: the whole word snaps to white then fades
 *    back to its base colour. Rank drives how many pulses fire per cycle:
 *    3rd → 1 pulse, 2nd → 2, 1st → 3.
 */
import React from 'react';
import { motion } from 'framer-motion';

interface WinningWordProps {
  word: string;
  /** 1-based leaderboard rank the player earned. Drives the medal colour. */
  rank: number;
  /** Whether dark mode is currently active. Affects base and pulse colours for non-medal ranks. */
  isDarkMode: boolean;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Base text colour for the word, as a CSS colour string. */
function rankColourHex(rank: number, isDarkMode: boolean): string {
  if (rank === 1) return '#facc15'; // yellow-400
  if (rank === 2) return '#cbd5e1'; // slate-300
  if (rank === 3) return '#d97706'; // amber-600
  // Match the LLM bubble text colour: gray-800 in light, gray-100 in dark
  return isDarkMode ? '#f3f4f6' : '#1f2937';
}

/** The colour the word pulses TO — should contrast with the base. */
function rankPulseColour(rank: number, isDarkMode: boolean): string {
  // Medal ranks always pulse to white (they're on a dark bubble in both modes)
  if (rank <= 3) return '#ffffff';
  // Non-medal: pulse to a contrasting accent rather than white/black
  return isDarkMode ? '#ffffff' : '#2563eb'; // white in dark, blue-600 in light
}

// ─── Wave animation constants ─────────────────────────────────────────────────

/** Each letter rises by this many pixels at the crest of the wave. */
const WAVE_RISE_PX = 6;

/** Duration of one full letter cycle (up + down) in seconds. */
const LETTER_DURATION = 0.5;

/** Delay between each letter's peak, creating the horizontal wave effect. */
const LETTER_STAGGER = 0.08;

/** How long to wait before the wave repeats (gap between cycles). */
const WAVE_REPEAT_DELAY = 0.6;

// ─── Pulse helpers ────────────────────────────────────────────────────────────

/** How many white pulses fire per cycle, keyed by rank. */
function pulseCount(rank: number): number {
  if (rank === 1) return 3;
  if (rank === 2) return 2;
  return 1;
}

/**
 * Build the Framer Motion `color` keyframe array for one cycle.
 *
 * Structure per pulse: [baseColour, '#ffffff', baseColour]
 * Between pulses and at cycle boundaries: baseColour (idle).
 *
 * Framer Motion interpolates evenly across keyframes, so the number of
 * frames directly controls dwell time. We insert extra baseColour frames
 * to create the "long gap, quick flash" rhythm.
 *
 *   gap ──────────── | snap white | fade back | gap ──── | ...
 */
function buildColourKeyframes(baseColour: string, pulses: number, pulseColour: string): string[] {
  // Minimal gap between pulses in a burst — just enough to register as separate flashes.
  const intraFrames = Array(1).fill(baseColour);
  // Single fade frame: burst snaps white then immediately returns to base.
  const fadeFrames  = Array(1).fill(baseColour);
  // Large tail keeps the pause between bursts long while the burst itself is rapid.
  const tailFrames  = Array(14).fill(baseColour);

  const frames: string[] = [];

  for (let p = 0; p < pulses; p++) {
    frames.push(pulseColour);      // snap to pulse colour
    frames.push(...fadeFrames);   // fade back to base over several steps
    if (p < pulses - 1) frames.push(...intraFrames); // short gap between pulses
  }

  frames.push(...tailFrames); // long pause after the burst
  return frames;
}

const WinningWord: React.FC<WinningWordProps> = ({ word, rank, isDarkMode }) => {
  const letters = word.split('');
  const totalWaveDuration = LETTER_DURATION + (letters.length - 1) * LETTER_STAGGER;
  const baseColour = rankColourHex(rank, isDarkMode);
  const pulseColour = rankPulseColour(rank, isDarkMode);
  const pulses = pulseCount(rank);

  /** Full animation cycle, kept in sync with the wave. */
  const cycleDuration = totalWaveDuration + WAVE_REPEAT_DELAY + 0.6;

  const colourKeyframes = buildColourKeyframes(baseColour, pulses, pulseColour);

  return (
    <span
      className="inline-block font-bold text-[1.1em]"
      style={{ verticalAlign: 'bottom' }}
    >
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          animate={{
            y:     [0, -WAVE_RISE_PX, 0],
            color: colourKeyframes,
          }}
          transition={{
            y: {
              duration:    LETTER_DURATION,
              delay:       i * LETTER_STAGGER,
              repeat:      Infinity,
              repeatDelay: WAVE_REPEAT_DELAY,
              ease:        'easeInOut',
            },
            color: {
              // Linear easing ensures every keyframe step takes identical time,
              // so each pulse's snap-and-fade is visually uniform regardless of
              // position in the sequence.
              duration:    cycleDuration,
              repeat:      Infinity,
              repeatDelay: 0,
              ease:        'linear',
            },
          }}
          style={{ display: 'inline-block', verticalAlign: 'bottom' }}
        >
          {letter}
        </motion.span>
      ))}
    </span>
  );
};

export default WinningWord;
