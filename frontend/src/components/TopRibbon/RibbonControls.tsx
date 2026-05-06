/**
 * Right-side controls component containing dark mode toggle and logout button.
 * Groups related utility controls together in a reusable component.
 * 
 * COMPONENT COMPOSITION:
 * - Each UI section becomes its own component
 */
import React from 'react';
import { motion } from 'framer-motion';

/**
 * Props interface
 * 
 * OPTIONAL PROPS:
 * - onLogout? means this prop is optional (note the ?)
 * - Component will work with or without a logout handler
 */
interface RibbonControlsProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout?: () => void;
}

/**
 * RibbonControls component
 * 
 * DESTRUCTURING PROPS:
 * - Instead of using `props.isDarkMode`, we destructure in the parameter
 * - Makes code cleaner and more readable inside the component
 */
const RibbonControls: React.FC<RibbonControlsProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onLogout,
}) => {
  /**
   * Handle logout click
   * 
   * DEFENSIVE PROGRAMMING:
   * - Check if onLogout exists before calling it
   * - Prevents errors if parent doesn't provide this optional prop
   */
  const handleLogout = () => {
    sessionStorage.removeItem('authenticated');
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="flex items-center space-x-4">
      
      {/* Dark Mode Toggle Button */}
      <motion.button
        onClick={onToggleDarkMode}
        className="btn-ghost"
        
        // Animation props for smooth interaction
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        
        // Accessibility: screen readers will announce this label
        aria-label="Toggle dark mode"
      >
        {/* Conditional rendering: show sun in dark mode, moon in light mode */}
        {isDarkMode ? '☀️' : '🌙'}
      </motion.button>

      {/* Logout Button */}
      <motion.button
        onClick={handleLogout}
        className="btn-danger text-2xl"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Logout"
        // title attribute shows tooltip on hover
        title="Logout"
      >
        ✕
      </motion.button>
    </div>
  );
};

export default RibbonControls;