import { Page } from '@playwright/test';

export async function mockGlobalApis(
  page: Page,
  options: {
    login?: string;
    roles?: string[];
    onboardingCompleted?: boolean;
  } = {}
) {
  const {
    login = 'testuser',
    roles = ['ROLE_USER'],
    onboardingCompleted = true,
  } = options;

  // 1. Account / Session (must match exactly /api/account)
  await page.route(/\/api\/account$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        login,
        email: `${login}@example.com`,
        authorities: roles,
      }),
    });
  });

  // 2. Onboarding State (must match exactly /api/onboarding/state)
  await page.route(/\/api\/onboarding\/state$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenant_id: 'tenant-123',
        user_id: 'user-123',
        onboarding_completed: onboardingCompleted,
        onboarding_step: onboardingCompleted ? 5 : 1,
        onboarding_started_at: '2026-06-22T20:00:00Z',
        total_steps: 5,
        steps: [
          { number: 1, key: 'welcome', title: 'Bienvenue', subtitle: 'Vos informations', icon: 'Sparkles', accent: 'primary', cta: 'Continuer' },
          { number: 2, key: 'diagnostic', title: 'Diagnostic', subtitle: 'Maturité IA', icon: 'Activity', accent: 'emerald', cta: 'Continuer' },
          { number: 3, key: 'documents', title: 'Documents', subtitle: 'Base de connaissances', icon: 'FolderUp', accent: 'cyan', cta: 'Continuer' },
          { number: 4, key: 'deliverable', title: 'Premier livrable', subtitle: 'Synthèse', icon: 'Wand2', accent: 'violet', cta: 'Terminer' },
          { number: 5, key: 'complete', title: 'Félicitations', subtitle: 'Prêt', icon: 'PartyPopper', accent: 'emerald', cta: 'Accéder à mon espace' },
        ],
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

  // 3. Notifications unread count (must match exactly /api/notification-center/unread-count)
  await page.route(/\/api\/notification-center\/unread-count$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unread_count: 0 }),
    });
  });

  // 4. User Personas (must match exactly /api/user-personas)
  await page.route(/\/api\/user-personas$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // 5. Default empty lists for queries (must not match the .ts code files)
  await page.route(/\/api\/company\/analyze(\?|$)/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else {
      await route.fallback();
    }
  });

  await page.route(/\/api\/ai-recommendations(\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route(/\/api\/rag-documents(\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}
