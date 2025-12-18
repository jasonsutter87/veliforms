/**
 * VeilForms - Settings Page
 */

"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStore } from "@/store/dashboard";
import { validatePassword, checkPasswordStrength } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();
  const dashboardUser = useDashboardStore((state) => state.user);

  // Profile form
  const [displayName, setDisplayName] = useState(dashboardUser?.name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  // Branding form
  const [brandColor, setBrandColor] = useState(
    dashboardUser?.settings?.brandColor || "#6366f1"
  );
  const [customLogo, setCustomLogo] = useState(
    dashboardUser?.settings?.customLogo || ""
  );
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState("");
  const [brandingError, setBrandingError] = useState("");

  // Retention form
  const [retentionDays, setRetentionDays] = useState(
    dashboardUser?.settings?.retentionDays?.toString() || "0"
  );
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionSuccess, setRetentionSuccess] = useState("");
  const [retentionError, setRetentionError] = useState("");

  // Export/Import
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPassword, setImportPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  // Handle password input change
  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordStrength(checkPasswordStrength(value));
  };

  // Save profile
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileSaving(true);

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: displayName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      setProfileSuccess("Profile updated successfully");
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Change password
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setPasswordError("Password requirements: " + validation.errors.join(", "));
      return;
    }

    setPasswordSaving(true);

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordSaving(false);
    }
  };

  // Save branding
  const handleBrandingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBrandingError("");
    setBrandingSuccess("");
    setBrandingSaving(true);

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/auth/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          brandColor,
          customLogo: customLogo || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save branding");
      }

      setBrandingSuccess("Branding saved successfully");
    } catch (err) {
      setBrandingError((err as Error).message);
    } finally {
      setBrandingSaving(false);
    }
  };

  // Save retention
  const handleRetentionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRetentionError("");
    setRetentionSuccess("");
    setRetentionSaving(true);

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/auth/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          retentionDays: parseInt(retentionDays, 10),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save retention settings");
      }

      setRetentionSuccess("Retention settings saved successfully");
    } catch (err) {
      setRetentionError((err as Error).message);
    } finally {
      setRetentionSaving(false);
    }
  };

  // Export keys (placeholder - actual implementation would use crypto)
  const handleExportKeys = async () => {
    if (exportPassword !== exportPasswordConfirm) {
      alert("Passwords do not match");
      return;
    }

    // This would encrypt and export keys
    alert("Key export functionality - implementation pending");
    setExportModalOpen(false);
  };

  // Import keys (placeholder)
  const handleImportKeys = async () => {
    if (!importFile) {
      alert("Please select a file");
      return;
    }

    // This would decrypt and import keys
    alert("Key import functionality - implementation pending");
    setImportModalOpen(false);
  };

  return (
    <div className="settings-view" style={{ display: "block" }}>
      <div className="settings-header">
        <h2>Account Settings</h2>
        <p className="settings-subtitle">
          Manage your account preferences and security settings
        </p>
      </div>

      {/* Profile Section */}
      <div className="settings-section">
        <h3>Profile</h3>
        <form onSubmit={handleProfileSubmit}>
          {profileError && <div className="error-message">{profileError}</div>}
          {profileSuccess && (
            <div className="success-message">{profileSuccess}</div>
          )}
          <div className="form-group">
            <label htmlFor="settings-email">Email Address</label>
            <input type="email" id="settings-email" value={user?.email || ""} disabled />
            <small>Contact support to change your email address</small>
          </div>
          <div className="form-group">
            <label htmlFor="settings-name">Display Name</label>
            <input
              type="text"
              id="settings-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={profileSaving}>
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>

      {/* Security Section */}
      <div className="settings-section">
        <h3>Security</h3>
        <form onSubmit={handlePasswordSubmit}>
          {passwordError && <div className="error-message">{passwordError}</div>}
          {passwordSuccess && (
            <div className="success-message">{passwordSuccess}</div>
          )}
          <div className="form-group">
            <label htmlFor="current-password">Current Password</label>
            <input
              type="password"
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input
              type="password"
              id="new-password"
              value={newPassword}
              onChange={(e) => handleNewPasswordChange(e.target.value)}
              required
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
                <li className={passwordStrength.number ? "valid" : ""}>Number</li>
              </ul>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
            {passwordSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Branding Section */}
      <div className="settings-section">
        <h3>Branding (Pro Feature)</h3>
        <form onSubmit={handleBrandingSubmit}>
          {brandingError && <div className="error-message">{brandingError}</div>}
          {brandingSuccess && (
            <div className="success-message">{brandingSuccess}</div>
          )}
          <div className="form-group">
            <label htmlFor="custom-logo">Custom Logo URL</label>
            <input
              type="url"
              id="custom-logo"
              value={customLogo}
              onChange={(e) => setCustomLogo(e.target.value)}
              placeholder="https://your-domain.com/logo.png"
            />
            <small>Logo displayed on form submissions and emails</small>
          </div>
          <div className="form-group">
            <label htmlFor="brand-color">Brand Color</label>
            <div className="color-input-wrapper">
              <input
                type="color"
                id="brand-color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
              />
              <input
                type="text"
                id="brand-color-hex"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={brandingSaving}>
            {brandingSaving ? "Saving..." : "Save Branding"}
          </button>
        </form>
      </div>

      {/* Data Retention Section */}
      <div className="settings-section">
        <h3>Data Retention</h3>
        <form onSubmit={handleRetentionSubmit}>
          {retentionError && <div className="error-message">{retentionError}</div>}
          {retentionSuccess && (
            <div className="success-message">{retentionSuccess}</div>
          )}
          <div className="form-group">
            <label htmlFor="retention-days">Auto-delete submissions after</label>
            <select
              id="retention-days"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
            >
              <option value="0">Never (keep forever)</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
            <small>Submissions older than this will be automatically deleted</small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={retentionSaving}>
            {retentionSaving ? "Saving..." : "Save Retention Settings"}
          </button>
        </form>
      </div>

      {/* Encryption Key Management Section */}
      <div className="settings-section">
        <h3>Encryption Key Management</h3>
        <p className="settings-description">
          Export and import your private encryption keys. Keep these secure -
          they are required to decrypt your form submissions.
        </p>
        <div className="key-management-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setExportModalOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export Keys
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setImportModalOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import Keys
          </button>
        </div>
        <div className="key-warning">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="20"
            height="20"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div>
            <strong>Important:</strong> Store your encryption keys safely. If you
            lose them, you won&apos;t be able to decrypt your submissions.
          </div>
        </div>
      </div>

      {/* Subscription Section */}
      <div className="settings-section">
        <h3>Subscription</h3>
        <div className="subscription-info">
          <div className="current-plan">
            <span className="plan-label">Current Plan</span>
            <span className="plan-name">{dashboardUser?.plan || "Free"}</span>
          </div>
          <div className="plan-features">
            <ul>
              {dashboardUser?.plan === "free" && (
                <>
                  <li>5 forms</li>
                  <li>100 submissions/month</li>
                  <li>7-day retention</li>
                </>
              )}
              {dashboardUser?.plan === "pro" && (
                <>
                  <li>Unlimited forms</li>
                  <li>10,000 submissions/month</li>
                  <li>90-day retention</li>
                  <li>Custom branding</li>
                </>
              )}
              {dashboardUser?.plan === "enterprise" && (
                <>
                  <li>Unlimited everything</li>
                  <li>Unlimited retention</li>
                  <li>Priority support</li>
                  <li>SSO/SAML</li>
                </>
              )}
            </ul>
          </div>
          <div className="subscription-actions">
            <button className="btn btn-primary">Upgrade Plan</button>
            {dashboardUser?.plan !== "free" && (
              <>
                <button className="btn btn-secondary">Manage Billing</button>
                <button className="btn btn-secondary">Cancel Subscription</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-section settings-danger">
        <h3>Danger Zone</h3>
        <div className="danger-item">
          <div>
            <strong>Export All Data</strong>
            <p>Download all your forms and submissions as a JSON file</p>
          </div>
          <button className="btn btn-secondary">Export Data</button>
        </div>
        <div className="danger-item">
          <div>
            <strong>Delete Account</strong>
            <p>Permanently delete your account and all associated data</p>
          </div>
          <button className="btn btn-danger">Delete Account</button>
        </div>
      </div>

      {/* Export Keys Modal */}
      {exportModalOpen && (
        <div className="modal" style={{ display: "flex" }}>
          <div
            className="modal-backdrop"
            onClick={() => setExportModalOpen(false)}
          ></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Export Encryption Keys</h2>
              <button
                className="modal-close"
                onClick={() => setExportModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="export-password">Encryption Password</label>
                <input
                  type="password"
                  id="export-password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Enter a strong password"
                  required
                />
                <small>
                  This password will encrypt your private keys before export.
                  Remember it!
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="export-password-confirm">Confirm Password</label>
                <input
                  type="password"
                  id="export-password-confirm"
                  value={exportPasswordConfirm}
                  onChange={(e) => setExportPasswordConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>
              <div className="warning-box">
                <strong>Keep this export file secure!</strong>
                <p>
                  The exported file contains all your private encryption keys,
                  protected by your password.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setExportModalOpen(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleExportKeys}>
                Export Keys
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Keys Modal */}
      {importModalOpen && (
        <div className="modal" style={{ display: "flex" }}>
          <div
            className="modal-backdrop"
            onClick={() => setImportModalOpen(false)}
          ></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Import Encryption Keys</h2>
              <button
                className="modal-close"
                onClick={() => setImportModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="import-file">Select Key Export File</label>
                <input
                  type="file"
                  id="import-file"
                  accept=".veilkeys"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  required
                />
                <small>Choose the .veilkeys file you exported earlier</small>
              </div>
              <div className="form-group">
                <label htmlFor="import-password">Decryption Password</label>
                <input
                  type="password"
                  id="import-password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter the password used during export"
                  required
                />
                <small>The password you used when exporting the keys</small>
              </div>
              <div className="warning-box">
                <strong>Warning:</strong> Importing keys will merge them with
                your existing keys. Forms with matching IDs will have their keys
                updated.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setImportModalOpen(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleImportKeys}>
                Import Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
