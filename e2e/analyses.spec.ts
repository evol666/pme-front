import { test, expect } from '@playwright/test';
import { mockGlobalApis } from './helpers';

test.describe('Company Analysis Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticated and onboarding done
    await mockGlobalApis(page, { onboardingCompleted: true });
  });

  test('should launch a company analysis, poll status, and display results', async ({ page }) => {
    // Mock get analyses history (initially empty)
    await page.route('**/api/company/analyze?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Navigate to /analyses page
    await page.goto('/analyses');

    // Fill in a SIREN
    await page.fill('#siren', '123456782');

    // Mock post call to launch analysis
    await page.route('**/api/company/analyze', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        expect(data.siren).toBe('123456782');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            job_id: 'job-123',
            status: 'pending',
          }),
        });
      }
    });

    // Mock polling endpoint for status
    let pollCount = 0;
    await page.route('**/api/company/analyze/job-123', async (route) => {
      pollCount++;
      if (pollCount === 1) {
        // First poll: still running
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            job_id: 'job-123',
            status: 'running',
            current_step: 'analyzing',
            progress: 40,
            started_at: new Date().toISOString(),
            completed_at: null,
            error: null,
            company: null,
            detected_business: null,
            recommended_tools: null,
            workflows: null,
            proposal: null,
            diagnostic: null,
          }),
        });
      } else {
        // Second poll: completed
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            job_id: 'job-123',
            status: 'completed',
            current_step: null,
            progress: 100,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            error: null,
            company: { name: 'Acme Logistics', siren: '123456782' },
            detected_business: { id: 'metier-1', label: 'Logistique et Transport' },
            recommended_tools: [
              { name: 'Outil de Suivi GPS', rationale: 'Optimisation de trajets', priority: 'haute' }
            ],
            workflows: [
              { title: 'Workflow Dispatch', summary: 'Automatisation des flux', effort: '1 semaine' }
            ],
            proposal: 'Ceci est la proposition stratégique globale.',
            diagnostic: 'Ceci est le diagnostic de maturité logistique.',
          }),
        });
      }
    });

    // Click on launch button
    await page.click('button[type="submit"]');

    // Should redirect to /analyse?jobId=job-123
    await expect(page).toHaveURL(/.*\/analyse\?jobId=job-123/);

    // Should automatically redirect to /resultat?jobId=job-123 after successful polling
    await expect(page).toHaveURL(/.*\/resultat\?jobId=job-123/);

    // Verify company name and metadata are shown
    await expect(page.locator('main h1')).toContainText('Acme Logistics');
    await expect(page.locator('text=Logistique et Transport')).toBeVisible();

    // Verify sections
    await expect(page.locator('text=Ceci est la proposition stratégique globale.')).toBeVisible();
    await expect(page.locator('text=Ceci est le diagnostic de maturité logistique.')).toBeVisible();

    // Verify recommendations
    await expect(page.locator('text=Outil de Suivi GPS')).toBeVisible();
    await expect(page.locator('text=Optimisation de trajets')).toBeVisible();

    // Verify workflows / plan d'action
    await expect(page.locator('text=Workflow Dispatch')).toBeVisible();
    await expect(page.locator('text=Automatisation des flux')).toBeVisible();
  });
});
