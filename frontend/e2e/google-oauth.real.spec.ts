import { expect, test } from '@playwright/test';

const runOAuth = process.env.PLAYWRIGHT_RUN_GOOGLE_OAUTH === 'true';
const googleEmail = process.env.PLAYWRIGHT_GOOGLE_EMAIL || '';
const googlePassword = process.env.PLAYWRIGHT_GOOGLE_PASSWORD || '';

test.describe('Google OAuth real browser flow', () => {
  test.skip(!runOAuth, 'set PLAYWRIGHT_RUN_GOOGLE_OAUTH=true to run this suite');
  test.skip(!googleEmail || !googlePassword, 'set PLAYWRIGHT_GOOGLE_EMAIL and PLAYWRIGHT_GOOGLE_PASSWORD');

  test('sign in with Google and return to app', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in with Google' }).click();

    await page.waitForURL(/accounts\.google\.com|google\.com/, { timeout: 60_000 });

    const existingAccountTile = page.getByText(googleEmail, { exact: false }).first();
    if (await existingAccountTile.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await existingAccountTile.click();
    } else {
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 30_000 });
      await emailInput.fill(googleEmail);
      await page.locator('#identifierNext button, #identifierNext').first().click();
    }

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 30_000 });
    await passwordInput.fill(googlePassword);
    await page.locator('#passwordNext button, #passwordNext').first().click();

    await page.waitForURL((url) => !/accounts\.google\.com|google\.com/.test(url.toString()), { timeout: 90_000 });
    await expect(page).toHaveURL(/select-role|hirer\/home|caregiver\/jobs\/feed|admin\/dashboard/);
  });
});
