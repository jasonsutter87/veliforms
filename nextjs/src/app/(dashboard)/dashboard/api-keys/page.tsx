/**
 * VeilForms - API Keys Page
 */

"use client";

import { useEffect, useState } from "react";
import { useDashboardStore, APIKey } from "@/store/dashboard";

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const AVAILABLE_PERMISSIONS = [
  { value: "forms:read", label: "Read forms" },
  { value: "forms:write", label: "Create/update forms" },
  { value: "submissions:read", label: "Read submissions" },
  { value: "submissions:delete", label: "Delete submissions" },
];

export default function APIKeysPage() {
  const {
    apiKeys,
    apiKeysLoading,
    setAPIKeys,
    addAPIKey,
    deleteAPIKey,
    setAPIKeysLoading,
  } = useDashboardStore();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "forms:read",
    "forms:write",
    "submissions:read",
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [keyCreatedModal, setKeyCreatedModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<APIKey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load API keys on mount
  useEffect(() => {
    const loadAPIKeys = async () => {
      setAPIKeysLoading(true);
      try {
        const token = localStorage.getItem("veilforms_token");
        const response = await fetch("/api/api-keys", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to load API keys");
        }

        const data = await response.json();
        setAPIKeys(data.keys || []);
      } catch (err) {
        console.error("Load API keys error:", err);
        setAPIKeys([]);
      }
    };

    loadAPIKeys();
  }, [setAPIKeys, setAPIKeysLoading]);

  const handlePermissionToggle = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setIsCreating(true);

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: keyName,
          permissions: selectedPermissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      // Add key to store (without the actual key value for security)
      addAPIKey({
        id: data.key.id,
        name: data.key.name,
        keyPrefix: data.key.keyPrefix,
        permissions: data.key.permissions,
        createdAt: data.key.createdAt,
      });

      // Show the key to the user
      setNewApiKey(data.key.key);
      setKeyCreatedModal(true);

      // Reset form
      setKeyName("");
      setSelectedPermissions(["forms:read", "forms:write", "submissions:read"]);
      setCreateModalOpen(false);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(newApiKey);
    setKeyCopied(true);
  };

  const handleDeleteClick = (key: APIKey) => {
    setKeyToDelete(key);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!keyToDelete) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/api-keys/${keyToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }

      deleteAPIKey(keyToDelete.id);
      setDeleteModalOpen(false);
      setKeyToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (apiKeysLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="api-keys-view" style={{ display: "block" }}>
      <div className="api-keys-header">
        <div>
          <h2>API Keys</h2>
          <p className="subtitle">
            Manage API keys for programmatic access to your forms and submissions
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setCreateModalOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="18"
            height="18"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create API Key
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              width="64"
              height="64"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
          </div>
          <h2>No API keys yet</h2>
          <p>Create an API key to access your forms programmatically.</p>
          <button
            className="btn btn-primary"
            onClick={() => setCreateModalOpen(true)}
          >
            Create API Key
          </button>
        </div>
      ) : (
        <div className="api-keys-table-wrapper">
          <table className="api-keys-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Permissions</th>
                <th>Last Used</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td className="key-name">{key.name}</td>
                  <td className="key-prefix">
                    <code>{key.keyPrefix}...</code>
                  </td>
                  <td className="key-permissions">
                    {key.permissions.map((p) => (
                      <span key={p} className="permission-badge">
                        {p.split(":")[1]}
                      </span>
                    ))}
                  </td>
                  <td className="key-last-used">
                    {key.lastUsedAt
                      ? formatRelativeTime(key.lastUsedAt)
                      : "Never"}
                  </td>
                  <td className="key-created">{formatDate(key.createdAt)}</td>
                  <td className="key-actions">
                    <button
                      className="btn-delete"
                      title="Delete"
                      onClick={() => handleDeleteClick(key)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="16"
                        height="16"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create API Key Modal */}
      {createModalOpen && (
        <div className="modal" style={{ display: "flex" }}>
          <div
            className="modal-backdrop"
            onClick={() => setCreateModalOpen(false)}
          ></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create API Key</h2>
              <button
                className="modal-close"
                onClick={() => setCreateModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {createError && <div className="error-message">{createError}</div>}
              <form onSubmit={handleCreateKey} id="create-api-key-form">
                <div className="form-group">
                  <label htmlFor="api-key-name">Key Name</label>
                  <input
                    type="text"
                    id="api-key-name"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    required
                    placeholder="e.g., Production Server"
                    maxLength={50}
                  />
                  <small>A descriptive name to identify this key</small>
                </div>
                <div className="form-group">
                  <label>Permissions</label>
                  <div className="checkbox-group">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <label key={perm.value}>
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.value)}
                          onChange={() => handlePermissionToggle(perm.value)}
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-api-key-form"
                className="btn btn-primary"
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Created Modal */}
      {keyCreatedModal && (
        <div className="modal" style={{ display: "flex" }}>
          <div className="modal-backdrop"></div>
          <div className="modal-content modal-warning">
            <div className="modal-header">
              <h2>API Key Created</h2>
            </div>
            <div className="modal-body">
              <div className="warning-box">
                <strong>Copy this key now!</strong>
                <p>
                  This is the only time you&apos;ll see this API key. We cannot
                  recover it.
                </p>
              </div>
              <div className="form-group">
                <label>Your API Key</label>
                <div className="api-key-display">
                  <code>{newApiKey}</code>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCopyKey}
                    aria-label="Copy API key to clipboard"
                  >
                    {keyCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <label className="confirm-save">
                <input
                  type="checkbox"
                  checked={keyCopied}
                  onChange={(e) => setKeyCopied(e.target.checked)}
                />
                I have copied my API key
              </label>
              <button
                className="btn btn-primary"
                disabled={!keyCopied}
                onClick={() => {
                  setKeyCreatedModal(false);
                  setNewApiKey("");
                  setKeyCopied(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && keyToDelete && (
        <div className="modal" style={{ display: "flex" }}>
          <div
            className="modal-backdrop"
            onClick={() => setDeleteModalOpen(false)}
          ></div>
          <div className="modal-content modal-danger">
            <div className="modal-header">
              <h2>Delete API Key</h2>
              <button
                className="modal-close"
                onClick={() => setDeleteModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{" "}
                <strong>{keyToDelete.name}</strong>?
              </p>
              <p className="text-muted">
                Any applications using this key will lose access. This action
                cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
