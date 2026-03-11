import { expect, test } from '@playwright/test';

test.describe('Google OAuth entry smoke', () => {
  test('routes to backend oauth endpoint', async ({ page }) => {
    await page.route('**/api/auth/google', async (route) => {
      await route.fulfill({
        status: 302,
        headers: {
          location: '/login',
        },
        body: '',
      });
    });

    await page.goto('/login');

    const oauthRequest = page.waitForRequest(
      (request) => request.url().includes('/api/auth/google') && request.method() === 'GET',
    );

    await page.getByRole('button', { name: 'Sign in with Google' }).click();

    const request = await oauthRequest;
    expect(request.url()).toContain('/api/auth/google');
  });
});
