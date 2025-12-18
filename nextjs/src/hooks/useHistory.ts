/**
 * VeilForms - useHistory Hook
 * Provides undo/redo functionality for form builder
 */

import { useState, useCallback } from 'react';

interface UseHistoryOptions<T> {
  maxHistory?: number;
}

export function useHistory<T>(initialState: T, options: UseHistoryOptions<T> = {}) {
  const { maxHistory = 50 } = options;

  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentState = history[currentIndex];

  const pushState = useCallback((newState: T) => {
    setHistory(prev => {
      // Remove any future states (if we undid and then made a new change)
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);

      // Limit history size
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        // When we shift, we need to adjust the index
        setCurrentIndex(maxHistory - 1);
        return newHistory;
      }

      // Set index to the new state
      setCurrentIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [currentIndex, maxHistory]);

  const undo = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setCurrentIndex(prev => Math.min(history.length - 1, prev + 1));
  }, [history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    state: currentState,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    historyLength: history.length,
    currentIndex,
  };
}
