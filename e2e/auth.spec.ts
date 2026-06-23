import { test, expect } from '@playwright/test';
import { mockGlobalApis } from './helpers';

test.describe('Authentication & Onboarding Guard', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on('request', req => console.log(`>> REQ: ${req.method()} ${req.url()}`));
    page.on('response', res => console.log(`<< RES: ${res.status()} ${res.url()}`));
  });
  test('should redirect to OAuth2 login when unauthorized (401)', async ({ page }) => {
    // Intercept api/account to return 401
    await page.route('**/api/account', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Intercept the oauth2 endpoint so it doesn't fail the navigation
    await page.route('**/oauth2/authorization/pme', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<h1>Mock OAuth2 Provider</h1>',
      });
    });

    // Go to dashboard
    await page.goto('/accueil');

    // Check that we are redirected to oauth2 authorization URL
    await expect(page).toHaveURL(/.*\/oauth2\/authorization\/pme.*/);
  });

  test('should redirect to onboarding if user is authenticated but onboarding is incomplete', async ({ page }) => {
    // Use the helper with onboardingCompleted: false
    await mockGlobalApis(page, { onboardingCompleted: false });

    // Welcome payload for step 1
    await page.route('**/api/onboarding/welcome', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          company_name: '',
          secteur: '',
          headcount: '',
          headcount_label: '',
          activity: '',
          prefilled: false,
          headcount_options: [
            { value: '1-10', label: '1 à 10 salariés' },
            { value: '11-49', label: '11 à 49 salariés' },
          ],
        }),
      });
    });

    // Go to dashboard
    await page.goto('/accueil');

    // Should redirect to /onboarding
    await expect(page).toHaveURL(/.*\/onboarding/);
  });

  test('should allow access to dashboard if authenticated and onboarding is completed', async ({ page }) => {
    // Use the helper with onboardingCompleted: true
    await mockGlobalApis(page, { onboardingCompleted: true });

    // Go to dashboard
    await page.goto('/accueil');

    // Should stay on /accueil and greet the user
    await expect(page).toHaveURL(/.*\/accueil/);
    await expect(page.locator('main h1')).toContainText('Bonjour, testuser');
  });
});
