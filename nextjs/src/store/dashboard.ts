/**
 * VeilForms - Dashboard Store (Zustand)
 */

import { create } from "zustand";

// Types
export interface Form {
  id: string;
  name: string;
  status: "active" | "paused";
  publicKey: JsonWebKey;
  submissionCount: number;
  lastSubmissionAt?: string;
  createdAt: string;
  updatedAt: string;
  settings?: {
    piiStrip?: boolean;
    webhookUrl?: string;
  };
  fields?: FormField[];
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  validation?: Record<string, unknown>;
}

export interface Submission {
  id: string;
  formId: string;
  encryptedData: string;
  decryptedData?: Record<string, unknown>;
  metadata: {
    submittedAt: string;
    userAgent?: string;
    ip?: string;
  };
  createdAt: string;
}

export interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  event: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  plan: "free" | "pro" | "enterprise";
  settings?: {
    brandColor?: string;
    customLogo?: string;
    retentionDays?: number;
  };
}

interface DashboardState {
  // User
  user: User | null;

  // Forms
  forms: Form[];
  currentForm: Form | null;
  formsLoading: boolean;
  formsError: string | null;

  // Submissions
  submissions: Submission[];
  submissionsLoading: boolean;
  submissionsPagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  } | null;

  // API Keys
  apiKeys: APIKey[];
  apiKeysLoading: boolean;

  // Audit Logs
  auditLogs: AuditLog[];
  auditLogsLoading: boolean;
  auditLogsPagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  } | null;

  // Decryption
  decryptionKey: JsonWebKey | null;
  rememberKey: boolean;

  // UI State
  sidebarOpen: boolean;
  currentPage: string;

  // Actions
  setUser: (user: User | null) => void;
  setForms: (forms: Form[]) => void;
  setCurrentForm: (form: Form | null) => void;
  addForm: (form: Form) => void;
  updateForm: (id: string, updates: Partial<Form>) => void;
  deleteForm: (id: string) => void;
  setFormsLoading: (loading: boolean) => void;
  setFormsError: (error: string | null) => void;

  setSubmissions: (submissions: Submission[]) => void;
  setSubmissionsLoading: (loading: boolean) => void;
  setSubmissionsPagination: (pagination: DashboardState["submissionsPagination"]) => void;
  updateSubmissionDecrypted: (id: string, decryptedData: Record<string, unknown>) => void;

  setAPIKeys: (keys: APIKey[]) => void;
  addAPIKey: (key: APIKey) => void;
  deleteAPIKey: (id: string) => void;
  setAPIKeysLoading: (loading: boolean) => void;

  setAuditLogs: (logs: AuditLog[]) => void;
  setAuditLogsLoading: (loading: boolean) => void;
  setAuditLogsPagination: (pagination: DashboardState["auditLogsPagination"]) => void;

  setDecryptionKey: (key: JsonWebKey | null) => void;
  setRememberKey: (remember: boolean) => void;

  setSidebarOpen: (open: boolean) => void;
  setCurrentPage: (page: string) => void;

  reset: () => void;
}

const initialState = {
  user: null,
  forms: [],
  currentForm: null,
  formsLoading: true,
  formsError: null,
  submissions: [],
  submissionsLoading: false,
  submissionsPagination: null,
  apiKeys: [],
  apiKeysLoading: false,
  auditLogs: [],
  auditLogsLoading: false,
  auditLogsPagination: null,
  decryptionKey: null,
  rememberKey: false,
  sidebarOpen: false,
  currentPage: "forms",
};

export const useDashboardStore = create<DashboardState>((set) => ({
  ...initialState,

  // User actions
  setUser: (user) => set({ user }),

  // Forms actions
  setForms: (forms) => set({ forms, formsLoading: false, formsError: null }),
  setCurrentForm: (currentForm) => set({ currentForm }),
  addForm: (form) => set((state) => ({ forms: [...state.forms, form] })),
  updateForm: (id, updates) =>
    set((state) => ({
      forms: state.forms.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      currentForm:
        state.currentForm?.id === id
          ? { ...state.currentForm, ...updates }
          : state.currentForm,
    })),
  deleteForm: (id) =>
    set((state) => ({
      forms: state.forms.filter((f) => f.id !== id),
      currentForm: state.currentForm?.id === id ? null : state.currentForm,
    })),
  setFormsLoading: (formsLoading) => set({ formsLoading }),
  setFormsError: (formsError) => set({ formsError, formsLoading: false }),

  // Submissions actions
  setSubmissions: (submissions) =>
    set({ submissions, submissionsLoading: false }),
  setSubmissionsLoading: (submissionsLoading) => set({ submissionsLoading }),
  setSubmissionsPagination: (submissionsPagination) =>
    set({ submissionsPagination }),
  updateSubmissionDecrypted: (id, decryptedData) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === id ? { ...s, decryptedData } : s
      ),
    })),

  // API Keys actions
  setAPIKeys: (apiKeys) => set({ apiKeys, apiKeysLoading: false }),
  addAPIKey: (key) => set((state) => ({ apiKeys: [...state.apiKeys, key] })),
  deleteAPIKey: (id) =>
    set((state) => ({ apiKeys: state.apiKeys.filter((k) => k.id !== id) })),
  setAPIKeysLoading: (apiKeysLoading) => set({ apiKeysLoading }),

  // Audit Logs actions
  setAuditLogs: (auditLogs) => set({ auditLogs, auditLogsLoading: false }),
  setAuditLogsLoading: (auditLogsLoading) => set({ auditLogsLoading }),
  setAuditLogsPagination: (auditLogsPagination) => set({ auditLogsPagination }),

  // Decryption actions
  setDecryptionKey: (decryptionKey) => set({ decryptionKey }),
  setRememberKey: (rememberKey) => set({ rememberKey }),

  // UI actions
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCurrentPage: (currentPage) => set({ currentPage }),

  // Reset
  reset: () => set(initialState),
}));
