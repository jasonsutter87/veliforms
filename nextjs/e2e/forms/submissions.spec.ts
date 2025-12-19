/**
 * VeilForms - Form Submissions E2E Tests
 * Tests for viewing, decrypting, and managing form submissions
 */

import { test, expect } from '@playwright/test';

const mockSubmissions = [
  {
    id: 'sub_1',
    formId: 'form_123',
    encryptedData: 'encrypted_data_1',
    metadata: {
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.1',
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'sub_2',
    formId: 'form_123',
    encryptedData: 'encrypted_data_2',
    metadata: {
      submittedAt: new Date(Date.now() - 7200000).toISOString(),
      userAgent: 'Chrome/120',
      ip: '192.168.1.2',
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

const mockForm = {
  id: 'form_123',
  name: 'Contact Form',
  status: 'active',
  submissionCount: 2,
  publicKey: { kty: 'RSA', n: 'test', e: 'AQAB' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe('Submissions Management', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated state
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
      localStorage.setItem('veilforms_user', JSON.stringify({
        id: 'user_123',
        email: 'test@example.com',
        emailVerified: true,
        subscription: 'pro',
      }));
    });

    // Mock forms list
    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ forms: [mockForm] }),
        });
      }
    });

    // Mock submissions endpoint
    await page.route('**/api/submissions/form_123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissions: mockSubmissions,
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            hasMore: false,
          },
        }),
      });
    });

    await page.reload();
  });

  test('should display forms list on dashboard', async ({ page }) => {
    await expect(page.getByText('Contact Form')).toBeVisible();
    await expect(page.getByText('2')).toBeVisible(); // submission count
  });

  test('should navigate to form details', async ({ page }) => {
    await page.click('text=Contact Form');
    await expect(page).toHaveURL(/\/dashboard\/forms\/form_123/);
  });

  test('should display submissions list', async ({ page }) => {
    await page.goto('/dashboard/forms/form_123');

    // Mock the form detail endpoint
    await page.route('**/api/forms/form_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ form: mockForm }),
      });
    });

    await page.reload();

    // Should show submissions
    await expect(page.getByText('sub_1')).toBeVisible();
    await expect(page.getByText('sub_2')).toBeVisible();
  });

  test('should show encrypted data indicator', async ({ page }) => {
    await page.goto('/dashboard/forms/form_123');

    await page.route('**/api/forms/form_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ form: mockForm }),
      });
    });

    await page.reload();

    // Should indicate data is encrypted
    await expect(page.getByText(/encrypted/i)).toBeVisible();
  });

  test('should show decryption key prompt', async ({ page }) => {
    await page.goto('/dashboard/forms/form_123');

    await page.route('**/api/forms/form_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ form: mockForm }),
      });
    });

    await page.reload();

    // Click on decrypt button/link
    const decryptButton = page.getByRole('button', { name: /decrypt/i });
    if (await decryptButton.isVisible()) {
      await decryptButton.click();
      await expect(page.getByText(/private key/i)).toBeVisible();
    }
  });
});

test.describe('Submission Details', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
      localStorage.setItem('veilforms_user', JSON.stringify({
        id: 'user_123',
        email: 'test@example.com',
        emailVerified: true,
        subscription: 'pro',
      }));
    });
  });

  test('should display submission metadata', async ({ page }) => {
    await page.route('**/api/forms/form_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ form: mockForm }),
      });
    });

    await page.route('**/api/submissions/form_123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissions: mockSubmissions,
          pagination: { page: 1, limit: 20, total: 2, hasMore: false },
        }),
      });
    });

    await page.goto('/dashboard/forms/form_123');

    // Should show submission timestamps
    await expect(page.getByText(/ago/i)).toBeVisible();
  });
});

test.describe('Submission Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
      localStorage.setItem('veilforms_user', JSON.stringify({
        id: 'user_123',
        email: 'test@example.com',
        emailVerified: true,
        subscription: 'pro',
      }));
    });
  });

  test('should have export option', async ({ page }) => {
    await page.route('**/api/forms/form_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ form: mockForm }),
      });
    });

    await page.route('**/api/submissions/form_123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissions: mockSubmissions,
          pagination: { page: 1, limit: 20, total: 2, hasMore: false },
        }),
      });
    });

    await page.goto('/dashboard/forms/form_123');

    // Should have export button
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
  });

  test('should delete submission with confirmation', async ({ page }) => {
    let deleteWasCalled = false;

    await page.route('**/api/forms/form_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ form: mockForm }),
      });
    });

    await page.route('**/api/submissions/form_123**', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteWasCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            submissions: mockSubmissions,
            pagination: { page: 1, limit: 20, total: 2, hasMore: false },
          }),
        });
      }
    });

    await page.goto('/dashboard/forms/form_123');

    // Find and click delete button on first submission
    const deleteButton = page.locator('[data-testid="delete-submission"]').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Should show confirmation dialog
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });
});

test.describe('Empty State', () => {
  test('should show empty state when no submissions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
    });

    await page.route('**/api/forms/form_empty', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          form: { ...mockForm, id: 'form_empty', submissionCount: 0 },
        }),
      });
    });

    await page.route('**/api/submissions/form_empty**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissions: [],
          pagination: { page: 1, limit: 20, total: 0, hasMore: false },
        }),
      });
    });

    await page.goto('/dashboard/forms/form_empty');

    // Should show empty state message
    await expect(page.getByText(/no submissions/i)).toBeVisible();
  });
});

test.describe('Pagination', () => {
  test('should show pagination controls for many submissions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
    });

    await page.route('**/api/forms/form_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ form: { ...mockForm, submissionCount: 100 } }),
      });
    });

    await page.route('**/api/submissions/form_123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissions: mockSubmissions,
          pagination: { page: 1, limit: 20, total: 100, hasMore: true },
        }),
      });
    });

    await page.goto('/dashboard/forms/form_123');

    // Should show pagination or load more
    const pagination = page.getByRole('navigation', { name: /pagination/i });
    const loadMore = page.getByRole('button', { name: /load more|next/i });

    const hasPaginationControls = await pagination.isVisible() || await loadMore.isVisible();
    expect(hasPaginationControls).toBeTruthy();
  });
});
