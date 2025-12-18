/**
 * VeilForms - Email Verification Page
 */

"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type VerifyStatus =
  | "loading"
  | "success"
  | "already"
  | "error"
  | "no-token";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [errorMessage, setErrorMessage] = useState(
    "The link may have expired or is invalid"
  );
  const [email, setEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Load pending email from localStorage
  useEffect(() => {
    const pendingEmail = localStorage.getItem("veilforms_pending_email");
    if (pendingEmail) {
      setEmail(pendingEmail);
    }
  }, []);

  // Verify token if present
  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(
          `/api/auth/verify?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          if (data.expired) {
            setErrorMessage(
              "This verification link has expired. Please request a new one."
            );
          } else {
            setErrorMessage(
              data.error || "Verification failed. The link may be invalid."
            );
          }
          setStatus("error");
          return;
        }

        if (data.alreadyVerified) {
          setStatus("already");
        } else {
          setStatus("success");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setErrorMessage("An error occurred. Please try again.");
        setStatus("error");
      }
    };

    verifyToken();
  }, [token]);

  const handleResend = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setResendSuccess(false);
    setResendError("");
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            data.error || "Too many requests. Please wait before trying again."
          );
        }
        throw new Error(data.error || "Failed to resend verification email");
      }

      if (data.alreadyVerified) {
        // Email is already verified, redirect to login
        window.location.href = "/login";
        return;
      }

      setResendSuccess(true);
    } catch (err) {
      setResendError((err as Error).message);
    } finally {
      setIsResending(false);
    }
  };

  const handleResendFromError = () => {
    setStatus("no-token");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Loading State */}
        {status === "loading" && (
          <div className="verify-status">
            <div className="spinner"></div>
            <h1>Verifying your email...</h1>
            <p className="subtitle">Please wait</p>
          </div>
        )}

        {/* Success State */}
        {status === "success" && (
          <div className="verify-status">
            <div className="success-icon">&#10003;</div>
            <h1>Email verified!</h1>
            <p className="subtitle">Your account is now active</p>
            <Link href="/login" className="btn">
              Sign In
            </Link>
          </div>
        )}

        {/* Already Verified State */}
        {status === "already" && (
          <div className="verify-status">
            <div className="success-icon">&#10003;</div>
            <h1>Already verified</h1>
            <p className="subtitle">Your email was already verified</p>
            <Link href="/login" className="btn">
              Sign In
            </Link>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="verify-status">
            <div className="error-icon">&#10005;</div>
            <h1>Verification failed</h1>
            <p className="subtitle">{errorMessage}</p>
            <div className="verify-actions">
              <button
                className="btn btn-secondary"
                onClick={handleResendFromError}
              >
                Resend verification email
              </button>
              <Link href="/register" className="btn">
                Create new account
              </Link>
            </div>
          </div>
        )}

        {/* No Token State - Check Your Email */}
        {status === "no-token" && (
          <div className="verify-status">
            <div className="info-icon">!</div>
            <h1>Check your email</h1>
            <p className="subtitle">
              We sent a verification link to your email address
            </p>
            <div className="resend-section">
              <p>Didn&apos;t receive it?</p>
              <form onSubmit={handleResend}>
                <div className="form-group">
                  <label htmlFor="email">Email address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={isResending}
                >
                  {isResending
                    ? "Sending..."
                    : resendSuccess
                      ? "Email sent!"
                      : "Resend verification email"}
                </button>
              </form>
              {resendSuccess && (
                <div className="success-message">
                  Verification email sent! Check your inbox.
                </div>
              )}
              {resendError && (
                <div className="error-message">{resendError}</div>
              )}
            </div>
          </div>
        )}

        <div className="auth-links">
          <p>
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card"><div className="spinner" /></div></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
