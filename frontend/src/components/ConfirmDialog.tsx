/**
 * ConfirmDialog component
 *
 * A modal confirmation window that floats above the section that triggered it.
 * The host section is blurred and tinted (darkened in light mode, lightened in
 * dark mode) to draw the user's eye to the dialog card.
 *
 * USAGE:
 *   Render <ConfirmDialog> as a sibling of your section content, inside a
 *   `relative` positioned container.  The overlay covers that container only,
 *   not the entire viewport, so siblings (e.g. the Top Ribbon) remain
 *   unaffected.
 *
 *   <div className="relative">
 *     <YourSectionContent />
 *     {dialogOpen && (
 *       <ConfirmDialog
 *         message="Are you sure?"
 *         confirmLabel="Yes"
 *         cancelLabel="No"
 *         onConfirm={handleConfirm}
 *         onCancel={() => setDialogOpen(false)}
 *       />
 *     )}
 *   </div>
 *
 * CURRENT USAGES:
 *  - BottomBar: "Skip score submission?" when the player declines the victory prompt.
 *    Reset does not use this dialog; it opens DifficultyDialog directly.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export interface ConfirmDialogProps {
  /** The question or statement presented to the user. */
  message: string;
  /** Optional secondary line shown in smaller muted text below the message. */
  detail?: string;
  /** Label for the affirmative button (default "Confirm"). */
  confirmLabel?: string;
  /** Label for the dismissal button (default "Cancel"). */
  cancelLabel?: string;
  /** Called when the user presses the confirm button. */
  onConfirm: () => void;
  /** Called when the user presses the cancel button or presses Escape. */
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  // Allow Escape to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Ignore backdrop pointer events briefly after mount so that gesture event
  // tails (whileTap completions, synthetic touch→mouse events, etc.) from the
  // button that opened the dialog cannot immediately dismiss it.
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setInteractive(true), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      key="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
        className={[
          'absolute inset-0 z-50',
          // Blur the content behind the dialog
          'backdrop-blur-sm',
          // Light mode: darken; dark mode: lighten
          'bg-white/40 dark:bg-black/40',
          'flex items-center justify-center px-4',
        ].join(' ')}
        // Pressing pointer down on the backdrop cancels.
        // Using onPointerDown rather than onClick prevents the click that
        // *opened* the dialog from immediately dismissing it: the backdrop
        // doesn't exist yet at pointerdown time, so it can never receive that
        // event — only deliberate new interactions reach this handler.
        onPointerDown={interactive ? onCancel : undefined}
      >
        {/* Dialog card — stop click propagation so the card itself doesn't cancel */}
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{ opacity: 0,   scale: 0.92, y: 16  }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={[
            'w-full max-w-sm',
            'bg-white dark:bg-gray-800',
            'rounded-2xl shadow-2xl',
            'px-6 py-6 space-y-5',
            'border border-gray-200 dark:border-gray-700',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Message */}
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
              {message}
            </p>
            {detail && (
              <p className="text-sm app-muted">{detail}</p>
            )}
          </div>

          {/* Buttons — confirm left, cancel right */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 btn btn-primary py-2 text-sm font-medium"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 btn btn-secondary py-2 text-sm"
            >
              {cancelLabel}
            </button>
          </div>
        </motion.div>
    </motion.div>
  );
};

export default ConfirmDialog;
