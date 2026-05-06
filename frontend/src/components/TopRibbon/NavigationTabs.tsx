/**
 * Navigation tabs section component that renders all navigation buttons.
 * Manages the list of nav items and delegates rendering to NavigationButton.
 * 
 * SEPARATION OF CONCERNS:
 * - This component owns the navigation data (navItems array)
 * - NavigationButton handles individual button rendering
 * - TopRibbon orchestrates layout but doesn't need nav details
 */
import React from 'react';
import NavigationButton from './NavigationButton';

/**
 * Props interface
 * 
 * We only need to know:
 * - What page we're currently on
 * - How to change pages
 */
interface NavigationTabsProps {
  currentPage: string;
  onPageChange: (page: 'chat' | 'leaderboard' | 'about' | 'howtoplay') => void;
}

/**
 * NavigationTabs component
 * 
 * TYPESCRIPT `as const`:
 * - Makes the array readonly and infers literal types
 * - Without it, id would be typed as `string`
 * - With it, id is typed as the specific literal: 'chat' | 'leaderboard' | etc.
 */
const NavigationTabs: React.FC<NavigationTabsProps> = ({ currentPage, onPageChange }) => {
  // Navigation items configuration
  // You could move this to a config file if it grows or needs to be shared
  const navItems = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'howtoplay', label: 'How To Play', icon: '🎯' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
  ] as const;

  return (
    <nav className="flex space-x-1">
      {/* 
        ARRAY MAPPING PATTERN:
        - .map() transforms each item in navItems array into a React element
        - key={item.id} helps React track which items changed (required for lists)
        - We pass down only what each button needs to know
      */}
      {navItems.map((item) => (
        <NavigationButton
          key={item.id}
          id={item.id}
          label={item.label}
          icon={item.icon}
          isActive={currentPage === item.id}
          onClick={() => onPageChange(item.id)}
        />
      ))}
    </nav>
  );
};

export default NavigationTabs;
