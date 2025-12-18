/**
 * VeilForms - Reset Password Page
 */

"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useAuth,
  validatePassword,
  checkPasswordStrength,
} from "@/hooks/useAuth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  const token = searchParams.get("token");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Check for token
  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      setShowForm(false);
    }
  }, [token]);

  // Update password strength on input
  useEffect(() => {
    setPasswordStrength(checkPasswordStrength(password));
  }, [password]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Check passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError("Password requirements: " + passwordCheck.errors.join(", "));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        let message = data.error || "Reset failed";
        if (data.details && data.details.length) {
          message = data.details.join(". ");
        }
        throw new Error(message);
      }

      setSuccess("Password reset successfully! Redirecting to login...");
      setShowForm(false);

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset password</h1>
        <p className="subtitle">Enter your new password</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {showForm && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={12}
              />
              <div className="password-strength">
                <small className="text-muted">Password must have:</small>
                <ul className="password-requirements">
                  <li className={passwordStrength.length ? "valid" : ""}>
                    12+ characters
                  </li>
                  <li className={passwordStrength.uppercase ? "valid" : ""}>
                    Uppercase letter
                  </li>
                  <li className={passwordStrength.lowercase ? "valid" : ""}>
                    Lowercase letter
                  </li>
                  <li className={passwordStrength.number ? "valid" : ""}>
                    Number
                  </li>
                </ul>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                name="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={12}
              />
            </div>

            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <div className="auth-links">
          <p>
            <Link href="/login">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card"><div className="spinner" /></div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
