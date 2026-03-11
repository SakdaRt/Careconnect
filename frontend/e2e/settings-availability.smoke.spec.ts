import { expect, test } from '@playwright/test';

const caregiverUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'caregiver.e2e@careconnect.local',
  phone_number: '0812345678',
  account_type: 'member',
  role: 'caregiver',
  status: 'active',
  trust_level: 'L2',
  trust_score: 85,
  name: 'ผู้ดูแล E2E',
  avatar: null,
  is_email_verified: true,
  is_phone_verified: true,
  completed_jobs_count: 12,
  first_job_waiver_used: false,
  policy_acceptances: {
    caregiver: {
      policy_accepted_at: '2026-03-11T00:00:00.000Z',
      version_policy_accepted: '2026-02-01',
    },
  },
  created_at: '2026-03-10T00:00:00.000Z',
  updated_at: '2026-03-11T00:00:00.000Z',
};

const defaultCaregiverProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: caregiverUser.id,
  display_name: 'ผู้ดูแล E2E',
  full_name: 'ผู้ดูแล ทดสอบ',
  bio: 'สำหรับทดสอบ Playwright',
  experience_years: 5,
  certifications: ['basic_first_aid'],
  specializations: ['companionship'],
  available_from: '08:00',
  available_to: '18:00',
  available_days: [2],
  total_jobs_completed: 12,
  average_rating: 4.8,
  total_reviews: 4,
  created_at: '2026-03-10T00:00:00.000Z',
  updated_at: '2026-03-11T00:00:00.000Z',
};

function jsonResponse(payload: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  };
}

test.describe('Caregiver settings smoke', () => {
  test.beforeEach(async ({ page }) => {
    let notificationPreferences = {
      email_enabled: false,
      push_enabled: false,
    };

    let caregiverProfile = {
      ...defaultCaregiverProfile,
    };

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            user: caregiverUser,
          },
        }),
      );
    });

    await page.route('**/api/notifications/unread-count**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: { count: 0 },
        }),
      );
    });

    await page.route('**/api/notifications/preferences', async (route) => {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON() as Partial<typeof notificationPreferences>;
        notificationPreferences = { ...notificationPreferences, ...payload };
      }

      await route.fulfill(
        jsonResponse({
          success: true,
          data: notificationPreferences,
        }),
      );
    });

    await page.route('**/api/notifications/push-subscriptions', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: { ok: true },
        }),
      );
    });

    await page.route('**/api/auth/profile', async (route) => {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON() as Partial<typeof caregiverProfile>;
        caregiverProfile = { ...caregiverProfile, ...payload };
        await route.fulfill(
          jsonResponse({
            success: true,
            data: { profile: caregiverProfile },
          }),
        );
        return;
      }

      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            role: 'caregiver',
            profile: caregiverProfile,
          },
        }),
      );
    });

    await page.addInitScript((seedUser) => {
      window.sessionStorage.setItem('careconnect_token', 'e2e-access-token');
      window.sessionStorage.setItem('careconnect_refresh_token', 'e2e-refresh-token');
      window.sessionStorage.setItem('careconnect_user', JSON.stringify(seedUser));
      window.sessionStorage.setItem('careconnect_active_role', 'caregiver');
    }, caregiverUser);
  });

  test('updates email notification preference', async ({ page }) => {
    await page.goto('/settings');

    const emailToggle = page.getByTestId('notification-email-toggle');
    await expect(emailToggle).not.toBeChecked();

    const updateRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/notifications/preferences') && request.method() === 'PUT',
    );

    await emailToggle.check();

    const request = await updateRequest;
    expect(request.postDataJSON()).toMatchObject({
      email_enabled: true,
      push_enabled: false,
    });
    await expect(emailToggle).toBeChecked();
  });

  test('updates caregiver availability schedule', async ({ page }) => {
    await page.goto('/caregiver/availability');

    await expect(page.getByRole('heading', { name: 'ปฏิทินเวลาว่างผู้ดูแล' })).toBeVisible();
    await page.getByTestId('availability-day-1').click();
    await page.getByTestId('availability-from').fill('09:00');
    await page.getByTestId('availability-to').fill('17:30');

    const updateRequest = page.waitForRequest(
      (request) => request.url().includes('/api/auth/profile') && request.method() === 'PUT',
    );

    await page.getByTestId('availability-save').click();

    const request = await updateRequest;
    expect(request.postDataJSON()).toMatchObject({
      available_from: '09:00',
      available_to: '17:30',
      available_days: [1, 2],
    });

    await expect(page.getByText('เลือกแล้ว 2 วัน')).toBeVisible();
  });
});
