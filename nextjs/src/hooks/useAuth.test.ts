/**
 * Tests for useAuth Hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, validatePassword, PASSWORD_REQUIREMENTS, checkPasswordStrength } from './useAuth';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useAuth());

      // Initially isLoading is true (will become false after useEffect)
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });

    it('should load user from localStorage if available', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        emailVerified: true,
        subscription: 'pro',
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('veilforms_token', 'test-token');
      localStorageMock.setItem('veilforms_user', JSON.stringify(mockUser));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('test-token');
    });

    it('should handle invalid JSON in localStorage', async () => {
      localStorageMock.setItem('veilforms_token', 'test-token');
      localStorageMock.setItem('veilforms_user', 'invalid-json');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('veilforms_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('veilforms_user');
    });

    it('should not authenticate if only token exists without user', async () => {
      localStorageMock.setItem('veilforms_token', 'test-token');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Login', () => {
    it('should login successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        emailVerified: true,
        subscription: 'free',
        createdAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token', user: mockUser }),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.login('test@example.com', 'password123');
        expect(response.token).toBe('new-token');
        expect(response.user).toEqual(mockUser);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('veilforms_token', 'new-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('veilforms_user', JSON.stringify(mockUser));
    });

    it('should handle login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.login('test@example.com', 'wrong-password');
        expect(response.error).toBe('Invalid credentials');
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle account lockout response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Account locked',
          attemptsRemaining: 0,
          lockedMinutes: 15,
        }),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.login('test@example.com', 'wrong-password');
        expect(response.error).toBe('Account locked');
        expect(response.lockedMinutes).toBe(15);
      });
    });

    it('should handle email not verified response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          emailNotVerified: true,
          email: 'test@example.com',
        }),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.login('test@example.com', 'password123');
        expect(response.emailNotVerified).toBe(true);
      });
    });
  });

  describe('Register', () => {
    it('should register successfully', async () => {
      const mockUser = {
        id: 'user_new',
        email: 'new@example.com',
        emailVerified: false,
        subscription: 'free',
        createdAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token', user: mockUser }),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.register('new@example.com', 'SecurePass123!');
        expect(response.token).toBe('new-token');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('veilforms_pending_email', 'new@example.com');
    });

    it('should handle registration failure with validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Validation failed',
          details: ['Password too weak', 'Email already exists'],
        }),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const response = await result.current.register('test@example.com', 'weak');
        expect(response.error).toBe('Validation failed');
        expect(response.details).toContain('Password too weak');
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        emailVerified: true,
        subscription: 'free',
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('veilforms_token', 'test-token');
      localStorageMock.setItem('veilforms_user', JSON.stringify(mockUser));

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('veilforms_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('veilforms_user');
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('should handle logout API error gracefully', async () => {
      localStorageMock.setItem('veilforms_token', 'test-token');
      localStorageMock.setItem('veilforms_user', JSON.stringify({ id: 'test', email: 'test@example.com', emailVerified: true, subscription: 'free', createdAt: '' }));

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Should still logout locally even if API fails
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  describe('Navigation Guards', () => {
    it('should redirect if authenticated', async () => {
      localStorageMock.setItem('veilforms_token', 'test-token');
      localStorageMock.setItem('veilforms_user', JSON.stringify({ id: 'test', email: 'test@example.com', emailVerified: true, subscription: 'free', createdAt: '' }));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.redirectIfAuthenticated('/dashboard');
      });

      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should not redirect if not authenticated', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.redirectIfAuthenticated('/dashboard');
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should require auth and redirect to login', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.requireAuth('/login');
      });

      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('should not redirect if already authenticated when requireAuth is called', async () => {
      localStorageMock.setItem('veilforms_token', 'test-token');
      localStorageMock.setItem('veilforms_user', JSON.stringify({ id: 'test', email: 'test@example.com', emailVerified: true, subscription: 'free', createdAt: '' }));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.requireAuth('/login');
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should accept valid strong password', () => {
      const result = validatePassword('SecurePass123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      const result = validatePassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('12'))).toBe(true);
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('alllowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('uppercase'))).toBe(true);
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('ALLUPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('lowercase'))).toBe(true);
    });

    it('should reject password without number', () => {
      const result = validatePassword('NoNumbersHere!!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('number'))).toBe(true);
    });
  });

  describe('checkPasswordStrength', () => {
    it('should return false indicators for short passwords', () => {
      const result = checkPasswordStrength('abc');
      expect(result.length).toBe(false);
      expect(result.uppercase).toBe(false);
    });

    it('should return partial indicators for medium passwords', () => {
      const result = checkPasswordStrength('password12');
      expect(result.length).toBe(false); // less than 12 chars
      expect(result.lowercase).toBe(true);
      expect(result.number).toBe(true);
      expect(result.uppercase).toBe(false);
    });

    it('should return mostly true for decent passwords', () => {
      const result = checkPasswordStrength('Password123!');
      expect(result.length).toBe(true); // 12 chars
      expect(result.uppercase).toBe(true);
      expect(result.lowercase).toBe(true);
      expect(result.number).toBe(true);
    });

    it('should return all true for excellent passwords', () => {
      const result = checkPasswordStrength('MySecure@Pass123!');
      expect(result.length).toBe(true);
      expect(result.uppercase).toBe(true);
      expect(result.lowercase).toBe(true);
      expect(result.number).toBe(true);
    });
  });

  describe('PASSWORD_REQUIREMENTS', () => {
    it('should export password requirements', () => {
      expect(PASSWORD_REQUIREMENTS).toBeDefined();
      expect(PASSWORD_REQUIREMENTS.minLength).toBe(12);
    });
  });
});
