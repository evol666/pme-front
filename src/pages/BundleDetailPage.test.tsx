import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type {
  StudioAgent,
  StudioApiRoute,
  StudioPage,
  StudioPrompt,
  StudioWorkflow,
} from '@/api/bundleStudio';
import type { StudioBundle } from '@/api/bundles';
import BundleDetailPage from './BundleDetailPage';

/**
 * Tests du détail d'un bundle métier : garde sur l'identifiant, chargement,
 * activation, et les cinq sections de composants qui ne s'affichent que si
 * elles contiennent quelque chose.
 */

const params = vi.hoisted(() => ({ current: { bundleId: '4' } as { bundleId?: string } }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useParams: () => params.current,
}));
vi.mock('sonner', () => ({ toast: toastMock }));

const studio = vi.hoisted(() => ({
  useStudioAgents: vi.fn(),
  useStudioPrompts: vi.fn(),
  useStudioPages: vi.fn(),
  useStudioApiRoutes: vi.fn(),
  useStudioWorkflows: vi.fn(),
  extractBackendError: vi.fn(),
  formatDateTime: vi.fn(),
}));
const bundles = vi.hoisted(() => ({
  useBundle: vi.fn(),
  useToggleBundle: vi.fn(),
  parseBundleManifest: vi.fn(),
}));

vi.mock('@/api/bundleStudio', () => studio);
vi.mock('@/api/bundles', () => bundles);

const bundle = (overrides: Partial<StudioBundle> = {}): StudioBundle =>
  ({
    id: 4,
    name: 'Expert-comptable',
    metierSlug: 'expert-comptable',
    isActive: false,
    manifest: '{"description":"Bundle comptable","version":"1.2.0"}',
    createdAt: '2026-06-01T09:00:00Z',
    project: { id: 1 },
    tenant: { id: 1 },
    ...overrides,
  }) as StudioBundle;

const prompt = (overrides: Partial<StudioPrompt> = {}): StudioPrompt =>
  ({
    id: 11,
    name: 'Synthèse de bilan',
    category: 'analyse',
    template: 'Résume le bilan de [entreprise].',
    variables: null,
    createdAt: '2026-06-01T09:00:00Z',
    bundle: bundle(),
    ...overrides,
  }) as StudioPrompt;

const workflow = (overrides: Partial<StudioWorkflow> = {}): StudioWorkflow =>
  ({
    id: 12,
    name: 'Revue annuelle',
    slug: 'revue-annuelle',
    definition: '{"steps":3}',
    createdAt: '2026-06-01T09:00:00Z',
    bundle: bundle(),
    ...overrides,
  }) as StudioWorkflow;

const page = (overrides: Partial<StudioPage> = {}): StudioPage =>
  ({
    id: 13,
    slug: 'tableau-de-bord',
    title: 'Tableau de bord comptable',
    layout: '{"grid":true}',
    createdAt: '2026-06-01T09:00:00Z',
    bundle: bundle(),
    ...overrides,
  }) as StudioPage;

const route = (overrides: Partial<StudioApiRoute> = {}): StudioApiRoute =>
  ({
    id: 14,
    method: 'POST',
    path: '/api/bilan',
    handler: 'BilanHandler',
    createdAt: '2026-06-01T09:00:00Z',
    bundle: bundle(),
    ...overrides,
  }) as StudioApiRoute;

const agent = (overrides: Partial<StudioAgent> = {}): StudioAgent =>
  ({
    id: 15,
    name: 'Analyste comptable',
    role: 'analyste',
    systemPrompt: 'Tu es un analyste comptable.',
    capabilities: null,
    createdAt: '2026-06-01T09:00:00Z',
    bundle: bundle(),
    ...overrides,
  }) as StudioAgent;

function requete(data: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isLoading: false, error: null, ...overrides };
}

function brancher(o: Record<string, unknown> = {}) {
  const toggle = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    ...(o.toggle as object),
  };

  bundles.useBundle.mockReturnValue(
    requete('bundle' in o ? o.bundle : bundle(), o.bundleQuery as object),
  );
  bundles.useToggleBundle.mockReturnValue(toggle);
  bundles.parseBundleManifest.mockImplementation((raw: string | null) =>
    raw ? JSON.parse(raw) : {},
  );

  studio.useStudioPrompts.mockReturnValue(requete('prompts' in o ? o.prompts : [prompt()]));
  studio.useStudioWorkflows.mockReturnValue(
    requete('workflows' in o ? o.workflows : [workflow()]),
  );
  studio.useStudioPages.mockReturnValue(requete('pages' in o ? o.pages : [page()]));
  studio.useStudioApiRoutes.mockReturnValue(requete('routes' in o ? o.routes : [route()]));
  studio.useStudioAgents.mockReturnValue(requete('agents' in o ? o.agents : [agent()]));
  studio.extractBackendError.mockImplementation(
    (err: unknown) => (err as Error)?.message ?? 'Erreur',
  );
  studio.formatDateTime.mockReturnValue('1 juin 2026');

  return { toggle };
}

const afficher = () => renderWithProviders(<BundleDetailPage />);

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { bundleId: '4' };
});

describe('Détail bundle — garde sur l’identifiant', () => {
  it('refuse un identifiant non numérique', () => {
    params.current = { bundleId: 'abc' };
    brancher();

    afficher();

    expect(screen.getByText(/Identifiant de bundle invalide/)).toBeInTheDocument();
    // Aucune requête ne doit partir sur un identifiant qui n'en est pas un.
    expect(bundles.useBundle).toHaveBeenCalledWith(null);
  });

  it('refuse un identifiant absent', () => {
    params.current = {};
    brancher();

    afficher();

    expect(screen.getByText(/Identifiant de bundle invalide/)).toBeInTheDocument();
  });

  it('refuse un identifiant nul ou négatif', () => {
    params.current = { bundleId: '0' };
    brancher();

    afficher();

    expect(screen.getByText(/Identifiant de bundle invalide/)).toBeInTheDocument();
  });
});

describe('Détail bundle — chargement', () => {
  it('signale le chargement', () => {
    brancher({ bundle: undefined, bundleQuery: { isLoading: true } });

    afficher();

    expect(screen.getByText(/Chargement du bundle…/)).toBeInTheDocument();
  });

  it('remonte l’erreur de chargement avec un retour au catalogue', () => {
    brancher({ bundle: undefined, bundleQuery: { error: new Error('404 introuvable') } });

    afficher();

    expect(screen.getByText(/404 introuvable/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retour au catalogue/ })).toBeInTheDocument();
  });

  it('n’affiche rien quand le bundle revient vide sans erreur', () => {
    brancher({ bundle: null });

    const { container } = afficher();

    expect(container.textContent).toBe('');
  });
});

describe('Détail bundle — présentation', () => {
  it('titre le bundle et reprend la description du manifest', () => {
    brancher();

    afficher();

    expect(screen.getByRole('heading', { name: 'Expert-comptable' })).toBeInTheDocument();
    expect(screen.getByText('Bundle comptable')).toBeInTheDocument();
    expect(screen.getByText(/Version 1.2.0/)).toBeInTheDocument();
    expect(screen.getByText('Inactif')).toBeInTheDocument();
  });

  it('signale un manifest sans description', () => {
    brancher({ bundle: bundle({ manifest: '{}' }) });

    afficher();

    expect(screen.getByText('Aucune description dans le manifest.')).toBeInTheDocument();
    expect(screen.queryByText(/Version/)).not.toBeInTheDocument();
  });

  it('marque un bundle déjà actif', () => {
    brancher({ bundle: bundle({ isActive: true }) });

    afficher();

    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bundle activé/ })).toBeDisabled();
  });

  it('affiche les métiers ciblés et les mots-clés du manifest', () => {
    brancher({
      bundle: bundle({
        manifest: '{"metier_ids":["compta"],"keywords":["bilan","liasse"]}',
      }),
    });

    afficher();

    expect(screen.getByText('Métiers ciblés')).toBeInTheDocument();
    expect(screen.getByText('bilan')).toBeInTheDocument();
  });

  it('masque le bloc de ciblage quand le manifest n’en contient pas', () => {
    brancher({ bundle: bundle({ manifest: '{"description":"x"}' }) });

    afficher();

    expect(screen.queryByText('Métiers ciblés')).not.toBeInTheDocument();
    expect(screen.queryByText('Mots-clés')).not.toBeInTheDocument();
  });

  it('expose le manifest brut en repli de lecture', () => {
    brancher();

    afficher();

    expect(screen.getByText('Manifest JSON brut')).toBeInTheDocument();
  });

  it('masque le manifest brut quand le bundle n’en a pas', () => {
    brancher({ bundle: bundle({ manifest: null }) });

    afficher();

    expect(screen.queryByText('Manifest JSON brut')).not.toBeInTheDocument();
  });
});

describe('Détail bundle — activation', () => {
  it('active le bundle et le confirme', async () => {
    const { toggle } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Activer ce bundle/ }));

    await waitFor(() =>
      expect(toggle.mutateAsync).toHaveBeenCalledWith({ id: 4, isActive: true }),
    );
    expect(toastMock.success).toHaveBeenCalledWith('Bundle activé');
    expect(screen.getByRole('button', { name: /Bundle activé/ })).toBeDisabled();
  });

  it('affiche l’échec de l’activation à l’écran et en notification', async () => {
    brancher({ toggle: { mutateAsync: vi.fn().mockRejectedValue(new Error('403 refusé')) } });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Activer ce bundle/ }));

    expect(await screen.findByText('403 refusé')).toBeInTheDocument();
    expect(toastMock.error).toHaveBeenCalledWith('403 refusé');
    // Le bouton reste actionnable pour permettre une nouvelle tentative.
    expect(screen.getByRole('button', { name: /Activer ce bundle/ })).not.toBeDisabled();
  });

  it('bloque le bouton pendant l’activation', () => {
    brancher({ toggle: { isPending: true } });

    afficher();

    expect(screen.getByRole('button', { name: /Activation en cours…/ })).toBeDisabled();
  });
});

describe('Détail bundle — composants', () => {
  it('affiche les cinq sections avec leur décompte', () => {
    brancher();

    afficher();

    for (const [libelle, nom] of [
      ['Prompts', 'Synthèse de bilan'],
      ['Workflows', 'Revue annuelle'],
      ['Pages', 'Tableau de bord comptable'],
      ['Routes API', 'POST /api/bilan'],
      ['Agents', 'Analyste comptable'],
    ]) {
      expect(screen.getByText(nom)).toBeInTheDocument();
      const titre = screen.getByText(libelle).closest('h2') as HTMLElement;
      expect(within(titre).getByText('(1)')).toBeInTheDocument();
    }
  });

  it('masque une section vide plutôt que d’afficher un titre orphelin', () => {
    brancher({ prompts: [], workflows: [], pages: [], routes: [] });

    afficher();

    expect(screen.queryByText('Prompts')).not.toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('annonce un bundle sans aucun composant', () => {
    brancher({ prompts: [], workflows: [], pages: [], routes: [], agents: [] });

    afficher();

    expect(screen.getByText('Bundle vide')).toBeInTheDocument();
  });

  it('tronque un corps trop long avec une ellipse', () => {
    brancher({ prompts: [prompt({ template: 'x'.repeat(400) })] });

    afficher();

    expect(screen.getByText(/x…$/)).toBeInTheDocument();
  });

  it('laisse intact un corps assez court', () => {
    brancher({ prompts: [prompt({ template: 'court' })] });

    afficher();

    expect(screen.getByText('court')).toBeInTheDocument();
  });

  it('omet sous-titre et corps quand ils sont absents', () => {
    brancher({
      prompts: [prompt({ category: null, template: null })],
      workflows: [],
      pages: [],
      routes: [],
      agents: [],
    });

    afficher();

    expect(screen.getByText('Synthèse de bilan')).toBeInTheDocument();
    expect(screen.queryByText('analyse')).not.toBeInTheDocument();
  });

  it('étiquette une route API de sa méthode HTTP', () => {
    brancher({ prompts: [], workflows: [], pages: [], agents: [] });

    afficher();

    // La méthode figure à la fois dans le titre et en étiquette.
    expect(screen.getAllByText(/POST/).length).toBeGreaterThan(1);
  });
});
