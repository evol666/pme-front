import { test, expect } from '@playwright/test';
import { mockGlobalApis } from './helpers';

test.describe('Dashboard (Accueil)', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticated and onboarding done
    await mockGlobalApis(page, { onboardingCompleted: true });
  });

  test('should display dashboard tiles and lists correctly with mock data', async ({ page }) => {
    // Mock analyses
    await page.route('**/api/company/analyze*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            job_id: 'job-1',
            siren: '123456789',
            status: 'completed',
            company_name: 'Acme Logistics',
            detected_business_label: 'Logistique',
            detected_business_id: 'metier-1',
            score: 84,
            progress: 100,
            current_step: null,
            created_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            error: null,
          },
          {
            job_id: 'job-2',
            siren: '987654321',
            status: 'failed',
            company_name: 'Beta Transport',
            detected_business_label: null,
            detected_business_id: null,
            score: null,
            progress: 50,
            current_step: 'analysis',
            created_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            completed_at: null,
            error: 'Database connection failed',
          }
        ]),
      });
    });

    // Mock recommendations
    await page.route('**/api/ai-recommendations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            title: 'Optimiser le RAG',
            action: 'rag-opt',
            status: 'new',
          },
          {
            id: 2,
            title: 'Mettre en place des agents de support',
            action: 'agent-support',
            status: 'accepted',
          }
        ]),
      });
    });

    // Mock documents
    await page.route('**/api/rag-documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'plaquette.pdf', status: 'COMPLETED' },
          { id: 2, name: 'contrat.pdf', status: 'INDEXING' }
        ]),
      });
    });

    await page.goto('/accueil');

    // Check greeting
    await expect(page.locator('main h1')).toContainText('Bonjour, testuser');

    // Check Tile counts
    // Analyses Tile value is total length (2)
    const analysesTile = page.locator('a[href="/analyses"]');
    await expect(analysesTile.locator('span.text-3xl')).toHaveText('2');

    // Recommandations Tile value is "new" count (1)
    const recosTile = page.locator('a[href="/recommandations"]');
    await expect(recosTile.locator('span.text-3xl')).toHaveText('1');

    // Documents Tile value is total length (2)
    const docsTile = page.locator('a[href="/documents"]');
    await expect(docsTile.locator('span.text-3xl')).toHaveText('2');

    // Check lists
    // Recent analyses
    await expect(page.locator('text=Acme Logistics')).toBeVisible();
    await expect(page.locator('text=Beta Transport')).toBeVisible();
    await expect(page.locator('text=completed').first()).toBeVisible();
    await expect(page.locator('text=failed')).toBeVisible();

    // Recent recommendations
    await expect(page.locator('text=Optimiser le RAG')).toBeVisible();
    await expect(page.locator('text=Mettre en place des agents')).toBeVisible();
  });
});
