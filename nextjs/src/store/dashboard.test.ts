/**
 * Tests for Dashboard Zustand Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from './dashboard';
import type { Form, Submission, APIKey, AuditLog, User } from './dashboard';

// Helper to reset store between tests
const resetStore = () => {
  useDashboardStore.getState().reset();
};

describe('Dashboard Store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useDashboardStore.getState();

      expect(state.user).toBeNull();
      expect(state.forms).toEqual([]);
      expect(state.currentForm).toBeNull();
      expect(state.formsLoading).toBe(true);
      expect(state.formsError).toBeNull();
      expect(state.submissions).toEqual([]);
      expect(state.submissionsLoading).toBe(false);
      expect(state.apiKeys).toEqual([]);
      expect(state.auditLogs).toEqual([]);
      expect(state.decryptionKey).toBeNull();
      expect(state.rememberKey).toBe(false);
      expect(state.sidebarOpen).toBe(false);
      expect(state.currentPage).toBe('forms');
    });
  });

  describe('User Actions', () => {
    it('should set user', () => {
      const mockUser: User = {
        id: 'user_123',
        email: 'test@example.com',
        plan: 'pro',
      };

      useDashboardStore.getState().setUser(mockUser);

      expect(useDashboardStore.getState().user).toEqual(mockUser);
    });

    it('should clear user', () => {
      useDashboardStore.getState().setUser({ id: 'test', email: 'test@test.com', plan: 'free' });
      useDashboardStore.getState().setUser(null);

      expect(useDashboardStore.getState().user).toBeNull();
    });
  });

  describe('Forms Actions', () => {
    const mockForm: Form = {
      id: 'form_123',
      name: 'Test Form',
      status: 'active',
      publicKey: {} as JsonWebKey,
      submissionCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should set forms and update loading state', () => {
      useDashboardStore.getState().setForms([mockForm]);

      const state = useDashboardStore.getState();
      expect(state.forms).toHaveLength(1);
      expect(state.forms[0]).toEqual(mockForm);
      expect(state.formsLoading).toBe(false);
      expect(state.formsError).toBeNull();
    });

    it('should set current form', () => {
      useDashboardStore.getState().setCurrentForm(mockForm);

      expect(useDashboardStore.getState().currentForm).toEqual(mockForm);
    });

    it('should add form to list', () => {
      useDashboardStore.getState().setForms([mockForm]);

      const newForm: Form = { ...mockForm, id: 'form_456', name: 'New Form' };
      useDashboardStore.getState().addForm(newForm);

      const state = useDashboardStore.getState();
      expect(state.forms).toHaveLength(2);
      expect(state.forms[1].id).toBe('form_456');
    });

    it('should update form in list', () => {
      useDashboardStore.getState().setForms([mockForm]);
      useDashboardStore.getState().updateForm('form_123', { name: 'Updated Form' });

      expect(useDashboardStore.getState().forms[0].name).toBe('Updated Form');
    });

    it('should update current form when updating same form', () => {
      useDashboardStore.getState().setForms([mockForm]);
      useDashboardStore.getState().setCurrentForm(mockForm);
      useDashboardStore.getState().updateForm('form_123', { name: 'Updated Form' });

      expect(useDashboardStore.getState().currentForm?.name).toBe('Updated Form');
    });

    it('should not update current form when updating different form', () => {
      const otherForm: Form = { ...mockForm, id: 'form_other' };
      useDashboardStore.getState().setForms([mockForm, otherForm]);
      useDashboardStore.getState().setCurrentForm(mockForm);
      useDashboardStore.getState().updateForm('form_other', { name: 'Updated Other' });

      expect(useDashboardStore.getState().currentForm?.name).toBe('Test Form');
    });

    it('should delete form from list', () => {
      useDashboardStore.getState().setForms([mockForm]);
      useDashboardStore.getState().deleteForm('form_123');

      expect(useDashboardStore.getState().forms).toHaveLength(0);
    });

    it('should clear current form when deleting it', () => {
      useDashboardStore.getState().setForms([mockForm]);
      useDashboardStore.getState().setCurrentForm(mockForm);
      useDashboardStore.getState().deleteForm('form_123');

      expect(useDashboardStore.getState().currentForm).toBeNull();
    });

    it('should set forms loading state', () => {
      useDashboardStore.getState().setFormsLoading(true);
      expect(useDashboardStore.getState().formsLoading).toBe(true);

      useDashboardStore.getState().setFormsLoading(false);
      expect(useDashboardStore.getState().formsLoading).toBe(false);
    });

    it('should set forms error and clear loading', () => {
      useDashboardStore.getState().setFormsLoading(true);
      useDashboardStore.getState().setFormsError('Failed to load forms');

      const state = useDashboardStore.getState();
      expect(state.formsError).toBe('Failed to load forms');
      expect(state.formsLoading).toBe(false);
    });
  });

  describe('Submissions Actions', () => {
    const mockSubmission: Submission = {
      id: 'sub_123',
      formId: 'form_123',
      encryptedData: 'encrypted_data_here',
      metadata: {
        submittedAt: new Date().toISOString(),
        userAgent: 'Mozilla/5.0',
      },
      createdAt: new Date().toISOString(),
    };

    it('should set submissions and clear loading', () => {
      useDashboardStore.getState().setSubmissionsLoading(true);
      useDashboardStore.getState().setSubmissions([mockSubmission]);

      const state = useDashboardStore.getState();
      expect(state.submissions).toHaveLength(1);
      expect(state.submissionsLoading).toBe(false);
    });

    it('should set submissions loading state', () => {
      useDashboardStore.getState().setSubmissionsLoading(true);
      expect(useDashboardStore.getState().submissionsLoading).toBe(true);
    });

    it('should set submissions pagination', () => {
      const pagination = {
        page: 1,
        limit: 20,
        total: 100,
        hasMore: true,
      };

      useDashboardStore.getState().setSubmissionsPagination(pagination);

      expect(useDashboardStore.getState().submissionsPagination).toEqual(pagination);
    });

    it('should update submission with decrypted data', () => {
      useDashboardStore.getState().setSubmissions([mockSubmission]);

      const decryptedData = { name: 'John Doe', email: 'john@example.com' };
      useDashboardStore.getState().updateSubmissionDecrypted('sub_123', decryptedData);

      expect(useDashboardStore.getState().submissions[0].decryptedData).toEqual(decryptedData);
    });

    it('should not update non-existent submission', () => {
      useDashboardStore.getState().setSubmissions([mockSubmission]);
      useDashboardStore.getState().updateSubmissionDecrypted('non_existent', { data: 'test' });

      expect(useDashboardStore.getState().submissions[0].decryptedData).toBeUndefined();
    });
  });

  describe('API Keys Actions', () => {
    const mockAPIKey: APIKey = {
      id: 'key_123',
      name: 'Production Key',
      keyPrefix: 'vf_prod_xxx',
      permissions: ['forms:read', 'forms:write'],
      createdAt: new Date().toISOString(),
    };

    it('should set API keys and clear loading', () => {
      useDashboardStore.getState().setAPIKeysLoading(true);
      useDashboardStore.getState().setAPIKeys([mockAPIKey]);

      const state = useDashboardStore.getState();
      expect(state.apiKeys).toHaveLength(1);
      expect(state.apiKeysLoading).toBe(false);
    });

    it('should add API key', () => {
      useDashboardStore.getState().setAPIKeys([mockAPIKey]);

      const newKey: APIKey = { ...mockAPIKey, id: 'key_456', name: 'Dev Key' };
      useDashboardStore.getState().addAPIKey(newKey);

      expect(useDashboardStore.getState().apiKeys).toHaveLength(2);
    });

    it('should delete API key', () => {
      useDashboardStore.getState().setAPIKeys([mockAPIKey]);
      useDashboardStore.getState().deleteAPIKey('key_123');

      expect(useDashboardStore.getState().apiKeys).toHaveLength(0);
    });

    it('should set API keys loading state', () => {
      useDashboardStore.getState().setAPIKeysLoading(true);
      expect(useDashboardStore.getState().apiKeysLoading).toBe(true);
    });
  });

  describe('Audit Logs Actions', () => {
    const mockAuditLog: AuditLog = {
      id: 'log_123',
      event: 'form.created',
      details: { formId: 'form_123' },
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
    };

    it('should set audit logs and clear loading', () => {
      useDashboardStore.getState().setAuditLogsLoading(true);
      useDashboardStore.getState().setAuditLogs([mockAuditLog]);

      const state = useDashboardStore.getState();
      expect(state.auditLogs).toHaveLength(1);
      expect(state.auditLogsLoading).toBe(false);
    });

    it('should set audit logs loading state', () => {
      useDashboardStore.getState().setAuditLogsLoading(true);
      expect(useDashboardStore.getState().auditLogsLoading).toBe(true);
    });

    it('should set audit logs pagination', () => {
      const pagination = {
        page: 2,
        limit: 50,
        total: 200,
        hasMore: true,
      };

      useDashboardStore.getState().setAuditLogsPagination(pagination);

      expect(useDashboardStore.getState().auditLogsPagination).toEqual(pagination);
    });
  });

  describe('Decryption Actions', () => {
    const mockDecryptionKey: JsonWebKey = {
      kty: 'RSA',
      n: 'test_n',
      e: 'test_e',
    };

    it('should set decryption key', () => {
      useDashboardStore.getState().setDecryptionKey(mockDecryptionKey);

      expect(useDashboardStore.getState().decryptionKey).toEqual(mockDecryptionKey);
    });

    it('should clear decryption key', () => {
      useDashboardStore.getState().setDecryptionKey(mockDecryptionKey);
      useDashboardStore.getState().setDecryptionKey(null);

      expect(useDashboardStore.getState().decryptionKey).toBeNull();
    });

    it('should set remember key preference', () => {
      useDashboardStore.getState().setRememberKey(true);
      expect(useDashboardStore.getState().rememberKey).toBe(true);

      useDashboardStore.getState().setRememberKey(false);
      expect(useDashboardStore.getState().rememberKey).toBe(false);
    });
  });

  describe('UI Actions', () => {
    it('should toggle sidebar', () => {
      useDashboardStore.getState().setSidebarOpen(true);
      expect(useDashboardStore.getState().sidebarOpen).toBe(true);

      useDashboardStore.getState().setSidebarOpen(false);
      expect(useDashboardStore.getState().sidebarOpen).toBe(false);
    });

    it('should set current page', () => {
      useDashboardStore.getState().setCurrentPage('settings');
      expect(useDashboardStore.getState().currentPage).toBe('settings');

      useDashboardStore.getState().setCurrentPage('api-keys');
      expect(useDashboardStore.getState().currentPage).toBe('api-keys');
    });
  });

  describe('Reset Action', () => {
    it('should reset store to initial state', () => {
      // Set various state
      useDashboardStore.getState().setUser({ id: 'test', email: 'test@test.com', plan: 'pro' });
      useDashboardStore.getState().setForms([{
        id: 'form_1',
        name: 'Form',
        status: 'active',
        publicKey: {} as JsonWebKey,
        submissionCount: 0,
        createdAt: '',
        updatedAt: '',
      }]);
      useDashboardStore.getState().setSidebarOpen(true);
      useDashboardStore.getState().setCurrentPage('settings');

      // Reset
      useDashboardStore.getState().reset();

      // Verify initial state
      const state = useDashboardStore.getState();
      expect(state.user).toBeNull();
      expect(state.forms).toEqual([]);
      expect(state.sidebarOpen).toBe(false);
      expect(state.currentPage).toBe('forms');
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple updates', () => {
      const store = useDashboardStore.getState();

      store.setUser({ id: 'user_1', email: 'user@test.com', plan: 'free' });
      store.setCurrentPage('api-keys');
      store.setSidebarOpen(true);

      const state = useDashboardStore.getState();
      expect(state.user?.id).toBe('user_1');
      expect(state.currentPage).toBe('api-keys');
      expect(state.sidebarOpen).toBe(true);
    });
  });
});
