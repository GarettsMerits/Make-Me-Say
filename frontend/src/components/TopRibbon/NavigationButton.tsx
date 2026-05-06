/**
 * Individual navigation button component with active state styling and animation.
 * Displays an icon, label, and animated underline indicator when active.
 */
import React from 'react';
import { motion } from 'framer-motion';

/**
 * Props interface for NavigationButton
 * 
 * Defining clear prop types helps catch bugs at compile-time
 */
interface NavigationButtonProps {
  id: string;                  // Unique identifier for this nav item
  label: string;               // Display text for the button
  icon: string;                // Emoji or icon to show before label
  isActive: boolean;           // Whether this button represents the current page
  onClick: () => void;         // Callback when button is clicked
}

/**
 * NavigationButton component
 * 
 * React.FC<PropsType> is TypeScript syntax meaning:
 * - React.FC = React Functional Component
 * - <PropsType> = Generic type parameter specifying what props this component accepts
 */
const NavigationButton: React.FC<NavigationButtonProps> = ({
  id,
  label,
  icon,
  isActive,
  onClick,
}) => {
  return (
    <motion.button
      onClick={onClick}
      
      className={`
        px-4 py-2 rounded-lg font-medium transition-colors relative overflow-hidden
        ${isActive
          ? 'text-gray-900 dark:text-gray-100 bg-layer-3-light dark:bg-layer-3-dark'
          : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-layer-3-light/50 dark:hover:bg-layer-3-dark/50'
        }
      `}

      // Framer Motion props for smooth interactive animations
      whileHover={{ scale: 1.05 }}   // Slightly grow on hover
      whileTap={{ scale: 0.95 }}     // Slightly shrink when clicked
    >
      {/* Button content: icon + label */}
      <span className="mr-2">{icon}</span>
      {/* Hide label text on smaller screens to prevent overlap with controls */}
      <span className="hidden md:inline">{label}</span>
      
      {/* Active indicator - animated underline */}
      {isActive && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 dark:bg-gray-200"
          // layoutId enables Framer Motion's shared layout animation
          // When switching between tabs, the underline smoothly slides to the new active button
          layoutId="activeTab"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );
};

export default NavigationButton;