/**
 * Fixed top navigation ribbon component with page navigation, dark mode toggle,
 * and logout functionality. Stays anchored to the top of the viewport and
 * includes animated tab indicators and hover effects.
 * 
 * COMPONENT STRUCTURE:
 * - This parent component handles layout and composition
 * - Sub-components (NavigationTabs, RibbonControls) handle their own rendering
 * - State management is still centralized in Zustand store
 * - Each piece is independently testable and maintainable
 */
import React from 'react';
import { useUIStore } from '../store';
import NavigationTabs from './TopRibbon/NavigationTabs';
import RibbonControls from './TopRibbon/RibbonControls';

/**
 * Props interface
 * 
 * TYPESCRIPT OPTIONAL PROPS:
 * - Parent components can provide this callback or omit it
 */
interface TopRibbonProps {
  onLogout?: () => void;
}

/**
 * COMPOSITION PATTERN:
 * - Parent manages state (via Zustand)
 * - Children receive only what they need via props
 */
const TopRibbon: React.FC<TopRibbonProps> = ({ onLogout }) => {
  // Pull state and actions from Zustand UI store
  // STORE SEPARATION: Only UI-related state, not game state
  // Component only re-renders when UI preferences change, not when game state changes
  const { isDarkMode, currentPage, setCurrentPage, toggleDarkMode } = useUIStore();

  return (
    // Dark mode wrapper - applies 'dark' class to enable Tailwind's dark mode variants
    // TAILWIND DARK MODE: When this class is present, all dark: prefixed styles activate
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      
      {/* 
        Fixed header container
        POSITIONING:
        - fixed: removes from normal document flow, positioned relative to viewport
        - top-0 left-0 right-0: stretches across entire top edge
        - z-50: stacking order ensures it stays above other content (z-index: 50)
      */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-layer-2-light dark:bg-layer-2-dark border-b border-gray-200 dark:border-gray-800 transition-colors">
        
        {/* Content wrapper with max width and responsive padding */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* 
            Main flex container - distributes sections across the ribbon
            FLEXBOX:
            - justify-center: centers the navigation tabs
            - items-center: vertically centers all children
            - h-16: sets fixed height (4rem / 64px)
            - relative: allows absolute positioning of corner sections
          */}
          <div className="flex justify-center items-center h-16 relative">
            
            {/* LEFT SECTION: Logo/Title */}
            {/* Hidden on smaller screens to prevent tab wrapping (lg:flex = show on large+ screens) */}
            {/* Positioned absolutely in left corner */}
            <div className="hidden lg:flex items-center absolute left-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Don't Make Me Say
              </h1>
            </div>

            {/* 
              CENTER SECTION: Navigation tabs
              COMPONENT COMPOSITION:
              - NavigationTabs owns nav items and button rendering
              - We just pass down what it needs from the store
              - Centered by parent's justify-center
            */}
            <NavigationTabs 
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />

            {/* 
              RIGHT SECTION: Controls
              COMPONENT COMPOSITION:
              - RibbonControls owns dark mode toggle and logout button
              - We pass down state/callbacks it needs
              - Positioned absolutely in right corner
            */}
            <div className="absolute right-0">
              <RibbonControls
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleDarkMode}
                onLogout={onLogout}
              />
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopRibbon;