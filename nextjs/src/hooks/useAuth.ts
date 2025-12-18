/**
 * VeilForms - Authentication Hook
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  subscription: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface LoginResponse {
  token: string;
  user: User;
  emailNotVerified?: boolean;
  email?: string;
  error?: string;
  attemptsRemaining?: number;
  lockedMinutes?: number;
}

interface RegisterResponse {
  token: string;
  user: User;
  error?: string;
  details?: string[];
}

// Password requirements (must match server)
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
};

// Validate password client-side
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("One uppercase letter");
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("One lowercase letter");
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push("One number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Check password strength indicators
export function checkPasswordStrength(password: string) {
  return {
    length: password.length >= PASSWORD_REQUIREMENTS.minLength,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Load auth state from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("veilforms_token");
    const userJson = localStorage.getItem("veilforms_user");

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        setState({
          user,
          token,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch {
        // Invalid JSON, clear storage
        localStorage.removeItem("veilforms_token");
        localStorage.removeItem("veilforms_user");
        setState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Login function
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResponse> => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return data;
      }

      localStorage.setItem("veilforms_token", data.token);
      localStorage.setItem("veilforms_user", JSON.stringify(data.user));

      setState({
        user: data.user,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });

      return data;
    },
    []
  );

  // Register function
  const register = useCallback(
    async (email: string, password: string): Promise<RegisterResponse> => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return data;
      }

      localStorage.setItem("veilforms_token", data.token);
      localStorage.setItem("veilforms_user", JSON.stringify(data.user));
      localStorage.setItem("veilforms_pending_email", email);

      setState({
        user: data.user,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });

      return data;
    },
    []
  );

  // Logout function
  const logout = useCallback(async () => {
    const token = localStorage.getItem("veilforms_token");

    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    localStorage.removeItem("veilforms_token");
    localStorage.removeItem("veilforms_user");
    localStorage.removeItem("veilforms_pending_email");

    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });

    router.push("/login");
  }, [router]);

  // Redirect if already authenticated
  const redirectIfAuthenticated = useCallback(
    (path = "/dashboard") => {
      if (state.isAuthenticated && !state.isLoading) {
        router.push(path);
      }
    },
    [state.isAuthenticated, state.isLoading, router]
  );

  // Require authentication
  const requireAuth = useCallback(
    (path = "/login") => {
      if (!state.isAuthenticated && !state.isLoading) {
        router.push(path);
      }
    },
    [state.isAuthenticated, state.isLoading, router]
  );

  return {
    ...state,
    login,
    register,
    logout,
    redirectIfAuthenticated,
    requireAuth,
  };
}
