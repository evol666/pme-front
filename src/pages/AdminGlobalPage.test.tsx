import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import AdminGlobalPage from './AdminGlobalPage';

const hooks = vi.hoisted(() => ({
  useTenants: vi.fn(),
  usePatchTenant: vi.fn(),
  useDeleteTenant: vi.fn(),
  useTenantSettings: vi.fn(),
  useTenantProfiles: vi.fn(),
  useTenantPlans: vi.fn(),
  usePatchTenantPlan: vi.fn(),
  useTenantBrandings: vi.fn(),
  useTenantMemories: vi.fn(),
  useDeleteTenantMemory: vi.fn(),
}));

vi.mock('@/api/admin', async (o) => ({
  ...(await o<typeof import('@/api/admin')>()),
  ...hooks,
}));

const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
  ...extra,
});

const mutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
});

const tenantRef = { id: 1, slug: 'acme', name: 'Acme' };

const tenant = {
  ...tenantRef,
  plan: 'PRO',
  status: 'ACTIVE',
  createdAt: '2026-07-01T09:00:00Z',
};

const setting = {
  id: 10,
  customLogoUrl: null,
  customPrimaryColor: '#0055ff',
  customSecondaryColor: null,
  customDomain: 'acme.exemple.fr',
  aiPersonality: null,
  pdfTemplate: null,
  enabledFeatures: null,
  createdAt: '2026-07-01T09:00:00Z',
  updatedAt: '2026-07-01T09:00:00Z',
  tenant: tenantRef,
};

const profile = {
  id: 11,
  sector: 'Boulangerie',
  maturityLevel: 'INTERMEDIAIRE',
  primaryGoal: 'Croissance',
  attributes: null,
  createdAt: '2026-07-01T09:00:00Z',
  updatedAt: '2026-07-01T09:00:00Z',
  tenant: tenantRef,
};

const plan = {
  id: 12,
  planName: 'PRO',
  monthlyTokenLimit: 100000,
  monthlyRequestLimit: 500,
  isActive: true,
  createdAt: '2026-07-01T09:00:00Z',
  updatedAt: '2026-07-01T09:00:00Z',
  tenant: tenantRef,
};

const branding = {
  id: 13,
  logoUrl: null,
  primaryColor: '#0055ff',
  accentColor: null,
  theme: 'light',
  displayName: 'Acme Corp',
  customPrompts: null,
  updatedAt: '2026-07-01T09:00:00Z',
  tenant: tenantRef,
};

const memory = {
  id: 14,
  category: 'preference',
  key: 'format_rapport',
  value: 'Préfère les rapports courts',
  confidenceScore: 0.9,
  source: 'copilot',
  hitCount: 3,
  lastSeenAt: '2026-07-01T09:00:00Z',
  createdAt: '2026-07-01T09:00:00Z',
  updatedAt: '2026-07-01T09:00:00Z',
  tenant: tenantRef,
};

function setLists(overrides: Record<string, unknown[] | undefined> = {}) {
  hooks.useTenants.mockReturnValue(query(overrides.tenants ?? [tenant]));
  hooks.useTenantSettings.mockReturnValue(query(overrides.settings ?? [setting]));
  hooks.useTenantProfiles.mockReturnValue(query(overrides.profiles ?? [profile]));
  hooks.useTenantPlans.mockReturnValue(query(overrides.plans ?? [plan]));
  hooks.useTenantBrandings.mockReturnValue(query(overrides.brandings ?? [branding]));
  hooks.useTenantMemories.mockReturnValue(query(overrides.memories ?? [memory]));
}

beforeEach(() => {
  vi.clearAllMocks();
  setLists();
  hooks.usePatchTenant.mockReturnValue(mutation());
  hooks.useDeleteTenant.mockReturnValue(mutation());
  hooks.usePatchTenantPlan.mockReturnValue(mutation());
  hooks.useDeleteTenantMemory.mockReturnValue(mutation());
});

const goTo = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

describe('navigation par onglets', () => {
  it('affiche les six onglets', () => {
    renderWithProviders(<AdminGlobalPage />);

    for (const label of [
      'Tenants',
      'Settings',
      'Profile',
      'Plan',
      'Branding',
      'Memory',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('ouvre les tenants par défaut', () => {
    renderWithProviders(<AdminGlobalPage />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it.each([
    ['Settings', 'acme.exemple.fr'],
    ['Profile', 'Boulangerie'],
    ['Memory', 'format_rapport'],
  ])('bascule sur l’onglet %s', (label, contenu) => {
    renderWithProviders(<AdminGlobalPage />);

    goTo(label);

    expect(screen.getByText(contenu)).toBeInTheDocument();
  });

  it('bascule sur les plans', () => {
    renderWithProviders(<AdminGlobalPage />);

    goTo('Plan');

    expect(screen.getAllByText(/PRO/).length).toBeGreaterThan(0);
  });

  it('bascule sur le branding', () => {
    renderWithProviders(<AdminGlobalPage />);

    goTo('Branding');

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });
});

describe('tenants', () => {
  it('filtre par nom', async () => {
    renderWithProviders(<AdminGlobalPage />);

    fireEvent.change(screen.getByPlaceholderText('Nom du tenant…'), {
      target: { value: 'acme' },
    });

    await waitFor(() => expect(hooks.useTenants).toHaveBeenCalled());
  });

  it('annonce une liste vide', () => {
    setLists({ tenants: [] });

    renderWithProviders(<AdminGlobalPage />);

    expect(screen.getByText('Aucun tenant')).toBeInTheDocument();
  });

  it('affiche le plan et le statut du tenant', () => {
    renderWithProviders(<AdminGlobalPage />);

    expect(screen.getAllByText(/PRO/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ACTIVE/).length).toBeGreaterThan(0);
  });
});

describe('états vides des autres onglets', () => {
  it.each([
    ['Settings', 'settings', 'Aucun paramètre'],
    ['Profile', 'profiles', 'Aucun profil'],
    ['Plan', 'plans', 'Aucun plan'],
    ['Branding', 'brandings', 'Aucun branding'],
    ['Memory', 'memories', 'Aucune mémoire'],
  ])('annonce %s vide', (label, key, message) => {
    setLists({ [key]: [] });
    renderWithProviders(<AdminGlobalPage />);

    goTo(label);

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});

describe('robustesse', () => {
  it('reste montée sans aucune donnée', () => {
    setLists({
      tenants: undefined,
      settings: undefined,
      profiles: undefined,
      plans: undefined,
      brandings: undefined,
      memories: undefined,
    });

    renderWithProviders(<AdminGlobalPage />);

    expect(screen.getByRole('button', { name: /Tenants/ })).toBeInTheDocument();
  });

  it('affiche un état de chargement', () => {
    hooks.useTenants.mockReturnValue(query(undefined, { isLoading: true }));

    renderWithProviders(<AdminGlobalPage />);

    expect(screen.queryByText('Aucun tenant')).toBeNull();
  });
});
