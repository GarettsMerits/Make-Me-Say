/**
 * Store Barrel Export
 * 
 * Central export point for all stores and types.
 */

// Export all stores
export { useUIStore } from './useUIStore';
export { useGameStore } from './useGameStore';

// Export shared types
export type { ChatMessage, PageType } from './types';

/**
 * USAGE IN COMPONENTS:
 * 
 * ```tsx
 * // Import only what you need
 * import { useUIStore } from './store';
 * // or
 * import { useGameStore } from './store';
 * // or both
 * import { useUIStore, useGameStore, ChatMessage } from './store';
 * ```
 */
