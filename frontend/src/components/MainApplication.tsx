/**
 * Main application component that handles routing between different pages
 * with smooth slide transitions. Manages dark mode and renders the top
 * navigation ribbon along with the current page content.
 */
import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '../store';
import { usePageTransitions } from '../store/usePageTransitions';
import TopRibbon from './TopRibbon';
import ChatPage from './ChatPage';
import HowToPlayPage from './HowToPlayPage';
import LeaderboardPage from './LeaderboardPage';
import AboutPage from './AboutPage';

interface MainApplicationProps {
  onLogout?: () => void;
}

const MainApplication: React.FC<MainApplicationProps> = ({ onLogout }) => {
  const { isDarkMode, currentPage } = useUIStore();
  const { direction, slideVariants, slideTransition } = usePageTransitions();

  // Apply dark mode to the document root for full page coverage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':        return <ChatPage />;
      case 'howtoplay':   return <HowToPlayPage />;
      case 'leaderboard': return <LeaderboardPage />;
      case 'about':       return <AboutPage />;
      default: {
        // TypeScript exhaustiveness check — if a new PageType is added to
        // types.ts without a matching case here, this line will be a compile error.
        const _exhausted: never = currentPage;
        console.error('Unhandled page type:', _exhausted);
        return <ChatPage />;
      }
    }
  };

  return (
    <div className={`min-h-screen bg-layer-1-light dark:bg-layer-1-dark transition-colors ${isDarkMode ? 'dark' : ''}`}>
      <TopRibbon onLogout={onLogout} />
      
      {/* Content area with top margin to account for fixed ribbon */}
      <div className="relative overflow-hidden min-h-screen">
        <div className="h-16"></div> {/* Spacer for fixed ribbon */}
        <AnimatePresence mode="sync" custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="absolute inset-0 w-full top-16"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MainApplication;