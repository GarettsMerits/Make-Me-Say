/**
 * Custom hook for managing page transition animations with directional swipe effects.
 * Calculates slide direction based on page navigation order and provides Framer Motion
 * variants and transition configurations for smooth page changes.
 */
import { useEffect, useRef } from 'react';
import { useUIStore } from './useUIStore';

export const usePageTransitions = () => {
  const { currentPage } = useUIStore();
  const previousPageRef = useRef(currentPage);

  // Define page order for determining swipe direction
  const pageOrder = ['chat', 'howtoplay', 'leaderboard', 'about'] as const;
  
  // Calculate direction synchronously during render
  const calculateDirection = () => {
    const previousPage = previousPageRef.current;
    const currentIndex = pageOrder.indexOf(currentPage as any);
    const previousIndex = pageOrder.indexOf(previousPage as any);
    
    if (currentIndex !== -1 && previousIndex !== -1 && currentIndex !== previousIndex) {
      return currentIndex > previousIndex ? 1 : -1;
    }
    return 0;
  };

  const direction = calculateDirection();

  // Update previous page reference after calculating direction
  useEffect(() => {
    previousPageRef.current = currentPage;
  }, [currentPage]);

  // Animation variants for page transitions
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      zIndex: 1,
    }),
    center: {
      x: 0,
      zIndex: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      zIndex: 0,
    }),
  };

  const slideTransition = {
    type: "tween" as const,
    ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    duration: 0.3,
  };

  return {
    direction,
    slideVariants,
    slideTransition,
  };
};