/**
 * VeilForms - useHistory Hook Tests
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from './useHistory';

describe('useHistory', () => {
  it('should initialize with initial state', () => {
    const { result } = renderHook(() => useHistory([1, 2, 3]));
    expect(result.current.state).toEqual([1, 2, 3]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should push new state', () => {
    const { result } = renderHook(() => useHistory([1, 2, 3]));

    act(() => {
      result.current.pushState([1, 2, 3, 4]);
    });

    expect(result.current.state).toEqual([1, 2, 3, 4]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should undo to previous state', () => {
    const { result } = renderHook(() => useHistory([1, 2, 3]));

    act(() => {
      result.current.pushState([1, 2, 3, 4]);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual([1, 2, 3]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should redo to next state', () => {
    const { result } = renderHook(() => useHistory([1, 2, 3]));

    act(() => {
      result.current.pushState([1, 2, 3, 4]);
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual([1, 2, 3, 4]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should clear redo history when pushing after undo', () => {
    const { result } = renderHook(() => useHistory([1, 2, 3]));

    act(() => {
      result.current.pushState([1, 2, 3, 4]);
      result.current.pushState([1, 2, 3, 4, 5]);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.pushState([1, 2, 3, 4, 6]);
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toEqual([1, 2, 3, 4, 6]);
  });

  it('should limit history size', () => {
    const { result } = renderHook(() => useHistory([1], { maxHistory: 3 }));

    act(() => {
      result.current.pushState([1, 2]);
      result.current.pushState([1, 2, 3]);
      result.current.pushState([1, 2, 3, 4]);
    });

    // History should not exceed maxHistory
    expect(result.current.historyLength).toBeLessThanOrEqual(3);
    // Should be at the last state
    expect(result.current.state).toEqual([1, 2, 3, 4]);
  });

  it('should not undo beyond first state', () => {
    const { result } = renderHook(() => useHistory([1, 2, 3]));

    act(() => {
      result.current.undo();
      result.current.undo();
      result.current.undo();
    });

    expect(result.current.state).toEqual([1, 2, 3]);
    expect(result.current.canUndo).toBe(false);
  });

  it('should not redo beyond last state', () => {
    const { result } = renderHook(() => useHistory([1, 2, 3]));

    act(() => {
      result.current.pushState([1, 2, 3, 4]);
    });

    act(() => {
      result.current.redo();
      result.current.redo();
    });

    expect(result.current.state).toEqual([1, 2, 3, 4]);
    expect(result.current.canRedo).toBe(false);
  });
});
