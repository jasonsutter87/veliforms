/**
 * VeilForms - Audit Logs Page
 */

"use client";

import { useEffect, useState } from "react";
import { useDashboardStore, AuditLog } from "@/store/dashboard";

// Format date/time
function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Event type colors and labels
const EVENT_TYPES: Record<string, { label: string; color: string }> = {
  "auth.login": { label: "Login", color: "info" },
  "auth.logout": { label: "Logout", color: "default" },
  "auth.register": { label: "Register", color: "success" },
  "auth.password_change": { label: "Password Change", color: "warning" },
  "auth.password_reset": { label: "Password Reset", color: "warning" },
  "form.create": { label: "Form Created", color: "success" },
  "form.update": { label: "Form Updated", color: "info" },
  "form.delete": { label: "Form Deleted", color: "danger" },
  "submission.received": { label: "Submission", color: "info" },
  "submission.delete": { label: "Submission Deleted", color: "danger" },
  "api_key.create": { label: "API Key Created", color: "success" },
  "api_key.delete": { label: "API Key Deleted", color: "danger" },
  "settings.update": { label: "Settings Updated", color: "info" },
  "subscription.upgrade": { label: "Plan Upgrade", color: "success" },
  "subscription.cancel": { label: "Plan Cancelled", color: "warning" },
};

export default function AuditLogsPage() {
  const {
    auditLogs,
    auditLogsLoading,
    auditLogsPagination,
    setAuditLogs,
    setAuditLogsLoading,
    setAuditLogsPagination,
  } = useDashboardStore();

  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState("");

  // Load audit logs
  const loadAuditLogs = async (page = 1) => {
    setAuditLogsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("veilforms_token");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });

      if (filter !== "all") {
        params.append("event", filter);
      }

      const response = await fetch(`/api/audit-logs?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }

      const data = await response.json();
      setAuditLogs(data.logs || []);
      setAuditLogsPagination({
        page: data.page || 1,
        limit: data.limit || 50,
        total: data.total || 0,
        hasMore: data.hasMore || false,
      });
    } catch (err) {
      console.error("Load audit logs error:", err);
      setError((err as Error).message);
      setAuditLogs([]);
    }
  };

  // Load on mount and when filter changes
  useEffect(() => {
    loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const getEventInfo = (event: string) => {
    return EVENT_TYPES[event] || { label: event, color: "default" };
  };

  const handleLoadMore = () => {
    if (auditLogsPagination?.hasMore) {
      loadAuditLogs(auditLogsPagination.page + 1);
    }
  };

  // Loading state
  if (auditLogsLoading && auditLogs.length === 0) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading audit logs...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-state">
        <div className="error-icon">!</div>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={() => loadAuditLogs()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="audit-logs-view" style={{ display: "block" }}>
      <div className="audit-logs-header">
        <div>
          <h2>Audit Logs</h2>
          <p className="subtitle">
            Track all account activity and security events
          </p>
        </div>
        <div className="audit-logs-filters">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Events</option>
            <optgroup label="Authentication">
              <option value="auth.login">Logins</option>
              <option value="auth.logout">Logouts</option>
              <option value="auth.password_change">Password Changes</option>
            </optgroup>
            <optgroup label="Forms">
              <option value="form.create">Form Created</option>
              <option value="form.update">Form Updated</option>
              <option value="form.delete">Form Deleted</option>
            </optgroup>
            <optgroup label="Submissions">
              <option value="submission.received">Submissions Received</option>
              <option value="submission.delete">Submissions Deleted</option>
            </optgroup>
            <optgroup label="API Keys">
              <option value="api_key.create">API Key Created</option>
              <option value="api_key.delete">API Key Deleted</option>
            </optgroup>
          </select>
        </div>
      </div>

      {auditLogs.length === 0 ? (
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <line x1="10" y1="9" x2="8" y2="9"></line>
            </svg>
          </div>
          <h2>No audit logs</h2>
          <p>
            {filter === "all"
              ? "Activity logs will appear here as you use VeilForms."
              : "No logs match the selected filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="audit-logs-table-wrapper">
            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Details</th>
                  <th>IP Address</th>
                  <th>Date/Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => {
                  const eventInfo = getEventInfo(log.event);
                  return (
                    <tr key={log.id}>
                      <td>
                        <span className={`event-badge event-${eventInfo.color}`}>
                          {eventInfo.label}
                        </span>
                      </td>
                      <td className="log-details">
                        {log.details ? (
                          <LogDetails details={log.details} event={log.event} />
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="log-ip">
                        {log.ip ? (
                          <code>{log.ip}</code>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="log-timestamp">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {auditLogsPagination?.hasMore && (
            <div className="load-more">
              <button
                className="btn btn-secondary"
                onClick={handleLoadMore}
                disabled={auditLogsLoading}
              >
                {auditLogsLoading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}

          {auditLogsPagination && (
            <div className="pagination-info">
              Showing {auditLogs.length} of {auditLogsPagination.total} logs
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Component to display log details nicely
function LogDetails({
  details,
  event,
}: {
  details: Record<string, unknown>;
  event: string;
}) {
  // Format details based on event type
  if (event.startsWith("form.")) {
    const formName = details.formName as string | undefined;
    const formId = details.formId as string | undefined;
    if (formName) {
      return <span>Form: {formName}</span>;
    }
    if (formId) {
      return (
        <span>
          Form ID: <code>{formId.substring(0, 8)}...</code>
        </span>
      );
    }
  }

  if (event.startsWith("api_key.")) {
    const keyName = details.keyName as string | undefined;
    if (keyName) {
      return <span>Key: {keyName}</span>;
    }
  }

  if (event.startsWith("submission.")) {
    const formName = details.formName as string | undefined;
    if (formName) {
      return <span>Form: {formName}</span>;
    }
  }

  if (event.startsWith("auth.")) {
    const method = details.method as string | undefined;
    if (method) {
      return <span>Method: {method}</span>;
    }
  }

  // Default: show first key-value pair
  const entries = Object.entries(details);
  if (entries.length > 0) {
    const [key, value] = entries[0];
    return (
      <span>
        {key}: {String(value)}
      </span>
    );
  }

  return <span className="text-muted">-</span>;
}
