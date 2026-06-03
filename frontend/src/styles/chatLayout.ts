/**
 * Shared layout constants for chat interface
 * 
 * PURPOSE:
 * - Centralizes layout values used across multiple components
 * - Ensures perfect alignment between messages and input box
 * - Single source of truth for spacing and sizing
 */

/**
 * Container layout configuration
 * 
 * These values are used by both ChatMessagesContainer and MessageInputBox
 * to ensure consistent width, padding, and alignment
 */
export const CHAT_LAYOUT = {
  /**
   * Maximum width constraint for chat content
   */
  maxWidth: 'max-w-4xl',
  
  /**
   * Horizontal padding for content area
   */
  horizontalPadding: 'px-4',
  
  /**
   * Vertical padding for messages area
   */
  verticalPadding: 'py-4',
  
  /**
   * Combined container classes
   * Use this for the wrapper div that contains messages or input
   */
  containerClasses: 'max-w-4xl mx-auto px-4',
} as const;

/**
 * Grid layout configuration for message alignment
 * 
 * Both ChatMessage and MessageInputBox use a CSS Grid with:
 * - Left column: flexible width (1fr) for message content
 * - Right column: fixed width (56px) for buttons
 */
export const MESSAGE_GRID = {
  /**
   * Width of the right column in pixels
   * Used for Reset/Submit buttons in input, spacer in LLM messages
   */
  rightColumnWidth: 56,
  
  /**
   * Width of the right column as a string (for inline styles)
   */
  rightColumnWidthPx: '56px',
  
  /**
   * Grid column template
   */
  gridColumns: 'grid-cols-[1fr_auto]',
  
  /**
   * Gap between grid columns
   */
  gridGap: 'gap-2',
  
  /**
   * Combined grid classes for messages and input
   */
  gridClasses: 'grid grid-cols-[1fr_auto] gap-2',
} as const;

/**
 * Input box specific dimensions
 * 
 * These need to be shared so the right column buttons can match
 * the textarea height exactly
 */
export const INPUT_BOX = {
  /**
   * Height of the textarea in pixels
   */
  textareaHeight: 120,
  
  /**
   * Height as a string for inline styles
   */
  textareaHeightPx: '120px',
} as const;

/**
 * The bottom bar inner container is always exactly this tall so the chat
 * scroll area never jumps when the bar transitions between states.
 *
 * Derivation (matching the normal input layout):
 *   SessionStats row  = ~28 px  (text-sm line + mb-2 gap)
 *   Textarea          = 120 px  (INPUT_BOX.textareaHeight)
 *   py-4 padding      =  32 px  (2 × 16 px)
 *   ─────────────────────────────
 *   Total             = 180 px
 */
export const BAR_BOTTOM = {
  height: 180,
  heightPx: '180px',
} as const;

/**
 * Helper function to get all container classes as a string
 * 
 * USAGE:
 * <div className={getChatContainerClasses('py-4')}>
 */
export const getChatContainerClasses = (additionalClasses: string = '') => {
  return `${CHAT_LAYOUT.containerClasses} ${additionalClasses}`.trim();
};

/**
 * Helper function to get grid classes
 * 
 * USAGE:
 * <div className={getMessageGridClasses('items-start')}>
 */
export const getMessageGridClasses = (additionalClasses: string = '') => {
  return `${MESSAGE_GRID.gridClasses} ${additionalClasses}`.trim();
};
