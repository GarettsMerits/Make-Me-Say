/**
 * UI Preferences Store
 * 
 * Manages user interface settings like dark mode and page navigation.
 * These preferences are persisted to localStorage so they survive page refreshes.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PageType } from './types';

/**
 * UI Store State Interface
 * 
 * FOCUSED RESPONSIBILITY:
 * - Only handles UI-related state (dark mode, navigation)
 * - No game logic mixed in
 * - Clear, single purpose
 */
interface UIState {
  // ===== STATE =====
  isDarkMode: boolean;              // Dark mode toggle state
  currentPage: PageType;            // Currently active page/route
  /**
   * When set, LeaderboardPage will scroll to the row with this DB id and
   * apply a highlight style, then clear the value.
   */
  pendingHighlightId: number | null;
  /**
   * True once the player has confirmed a difficulty at least once.
   * Used to detect first-time visitors and send them to How To Play.
   */
  hasSeenGame: boolean;
  
  // ===== ACTIONS =====
  toggleDarkMode: () => void;
  setCurrentPage: (page: PageType) => void;
  setPendingHighlightId: (id: number | null) => void;
  setHasSeenGame: () => void;
}

/**
 * Create UI preferences store
 * 
 * PERSISTENCE:
 * - Saves to localStorage under 'ui-preferences' key
 * - All UI state is persisted (users appreciate this!)
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // ===== INITIAL VALUES =====
      isDarkMode: false,
      currentPage: 'howtoplay',
      pendingHighlightId: null,
      hasSeenGame: false,
      
      // ===== ACTION IMPLEMENTATIONS =====
      
      toggleDarkMode: () => set((state) => ({ 
        isDarkMode: !state.isDarkMode 
      })),
      
      setCurrentPage: (page) => set({ currentPage: page }),

      setPendingHighlightId: (id) => set({ pendingHighlightId: id }),

      setHasSeenGame: () => set({ hasSeenGame: true }),
    }),
    {
      name: 'ui-preferences',  // localStorage key
      // No partialize needed - we want to persist everything in this store
    }
  )
);

/**
 * USAGE EXAMPLE:
 * 
 * ```tsx
 * import { useUIStore } from './store';
 * 
 * function Navigation() {
 *   const { isDarkMode, toggleDarkMode } = useUIStore();
 *   
 *   return (
 *     <button onClick={toggleDarkMode}>
 *       {isDarkMode ? '☀️' : '🌙'}
 *     </button>
 *   );
 * }
 * ```
 */
