import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard Flow', () => {
  test('should go through the 5-step onboarding wizard successfully', async ({ page }) => {
    // Authenticated user
    await page.route('**/api/account', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          login: 'testuser',
          email: 'test@example.com',
          authorities: ['ROLE_USER'],
        }),
      });
    });

    // Mock other layout components (notifications and user personas) to prevent 401s
    await page.route('**/api/notification-center/unread-count', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unread_count: 0 }),
      });
    });

    await page.route('**/api/user-personas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock mutable state for onboarding
    let onboardingStep = 1;
    let onboardingCompleted = false;

    // Define Step Definitions
    const steps = [
      { number: 1, key: 'welcome', title: 'Bienvenue', subtitle: 'Vos informations', icon: 'Sparkles', accent: 'primary', cta: 'Continuer' },
      { number: 2, key: 'diagnostic', title: 'Diagnostic', subtitle: 'Maturité IA', icon: 'Activity', accent: 'emerald', cta: 'Continuer' },
      { number: 3, key: 'documents', title: 'Documents', subtitle: 'Base de connaissances', icon: 'FolderUp', accent: 'cyan', cta: 'Continuer' },
      { number: 4, key: 'deliverable', title: 'Premier livrable', subtitle: 'Synthèse', icon: 'Wand2', accent: 'violet', cta: 'Terminer' },
      { number: 5, key: 'complete', title: 'Félicitations', subtitle: 'Prêt', icon: 'PartyPopper', accent: 'emerald', cta: 'Accéder à mon espace' },
    ];

    await page.route('**/api/onboarding/state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenant_id: 'tenant-123',
          user_id: 'user-123',
          onboarding_completed: onboardingCompleted,
          onboarding_step: onboardingStep,
          onboarding_started_at: '2026-06-22T20:00:00Z',
          total_steps: 5,
          steps,
          data: {},
          summary: onboardingCompleted ? {
            maturity_score: 72,
            maturity_level: 'Opérationnel',
            documents_count: 3,
            first_deliverable: { kind: 'synthèse', label: 'Synthèse Stratégique' },
            next_actions: [{ label: 'Lancer un audit complet', deep_route: '/analyse' }],
          } : undefined,
        }),
      });
    });

    // Mock startup endpoint
    await page.route('**/api/onboarding/start', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // Mock step advancement
    await page.route('**/api/onboarding/step', async (route) => {
      const payload = route.request().postDataJSON();
      onboardingStep = payload.step;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock onboarding complete
    await page.route('**/api/onboarding/complete', async (route) => {
      onboardingCompleted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock step 1 Welcome APIs
    await page.route('**/api/onboarding/welcome', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            company_name: 'Acme Corp',
            secteur: 'Services',
            headcount: '11-49',
            headcount_label: '11 à 49 salariés',
            activity: 'IA et dev',
            prefilled: false,
            headcount_options: [
              { value: '1-10', label: '1 à 10 salariés' },
              { value: '11-49', label: '11 à 49 salariés' },
            ],
          }),
        });
      }
    });

    // Mock step 2 Diagnostic API
    await page.route('**/api/onboarding/diagnostic', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          maturity: {
            snapshot: {
              global_score: 65,
              overall_level: 'Moyen',
              dimensions: [
                { dimension_key: 'infra', dimension_label: 'Infrastructure', score: 80 },
                { dimension_key: 'skills', dimension_label: 'Compétences', score: 50 },
              ],
            },
            roadmap: [],
          },
          profile: {
            activity_summary: 'Secteur informatique',
            positioning: 'Innovateur',
            offerings: ['SaaS', 'Consulting'],
            targets: ['PME', 'ETI'],
            differentiators: ['Agilité', 'R&D'],
            confidence_score: 90,
            documents_count: 0,
          },
          persona: {
            code: 'dirigeant',
            label: "Chef d'entreprise visionnaire",
            confidence: 0.95,
          },
          generated_at: new Date().toISOString(),
        }),
      });
    });

    // Mock step 4 Deliverables API
    await page.route('**/api/onboarding/deliverables', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { key: 'synthèse', label: 'Synthèse Stratégique', description: 'Synthèse de vos enjeux', icon: 'Wand2', accent: 'violet', deep_route: '/documents' }
          ]
        }),
      });
    });

    await page.route('**/api/onboarding/deliverable', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'synthèse',
          label: 'Synthèse Stratégique',
          deep_route: '/documents',
          markdown: '# Synthèse Stratégique pour Acme Corp\n\nVoici le premier livrable.',
          generated_at: new Date().toISOString(),
        }),
      });
    });

    // Start E2E test navigation
    await page.goto('/onboarding');

    // Step 1: Welcome
    await expect(page.locator('h2')).toContainText('Bienvenue 👋');
    await page.fill('input[placeholder="Ex. Acme Conseil"]', 'Acme Corp');
    await page.click('button:has-text("Continuer")');

    // Step 2: Diagnostic
    await expect(page.locator('h2')).toContainText('Votre diagnostic');
    await expect(page.locator("text=Chef d'entreprise visionnaire")).toBeVisible();
    await page.click('button:has-text("Continuer")');

    // Step 3: Documents
    await expect(page.locator('h2')).toContainText('Vos documents');
    await page.click('button:has-text("Continuer")');

    // Step 4: Deliverables
    await expect(page.locator('h2')).toContainText('Votre premier livrable');
    await page.click('button:has-text("Synthèse Stratégique")');
    await expect(page.locator('pre')).toContainText('Voici le premier livrable');
    await page.click('button:has-text("Terminer")');

    // Step 5: Congratulations / Completion
    await expect(page.locator('h2')).toContainText('Félicitations !');
    await expect(page.locator('text=Documents intégrés')).toBeVisible();

    // Mock API home data to stay on homepage
    await page.route(/\/api\/company\/analyze(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route(/\/api\/recommandations(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route(/\/api\/documents(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Click to access the dashboard
    await page.click('button:has-text("Accéder à mon espace")');

    // Should stay on /accueil and greet the user
    await expect(page).toHaveURL(/.*\/accueil/);
  });
});
