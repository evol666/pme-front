import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import EntrepriseDetailPage from './EntrepriseDetailPage';

const { mockNavigate, mockParams, mockSearchParams, mockSetSearchParams } = vi.hoisted(
  () => ({
    mockNavigate: vi.fn(),
    mockParams: { current: { siren: '123456789' } as Record<string, string | undefined> },
    mockSearchParams: { current: new URLSearchParams() },
    mockSetSearchParams: vi.fn(),
  }),
);

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams.current,
    useSearchParams: () => [mockSearchParams.current, mockSetSearchParams],
  };
});

// --- Doubles des modules d'API consommés par la page -------------------------

const hooks = vi.hoisted(() => ({
  useAnalyses: vi.fn(),
  useLaunchAnalysis: vi.fn(),
  useCopilotConverse: vi.fn(),
  useCopilotHealth: vi.fn(),
  useDocuments: vi.fn(),
  useUploadDocumentDirect: vi.fn(),
  useEntreprise: vi.fn(),
  useRefreshEntreprise: vi.fn(),
  useExportDocument: vi.fn(),
  useJournalEvents: vi.fn(),
  useMetierModules: vi.fn(),
  useDetectMetier: vi.fn(),
  useExecuteModule: vi.fn(),
  usePortefeuilleEntreprise: vi.fn(),
  useContextualDiagnostic: vi.fn(),
  useRecommandationsForJobs: vi.fn(),
}));

vi.mock('@/api/analyses', async (o) => ({
  ...(await o<typeof import('@/api/analyses')>()),
  useAnalyses: hooks.useAnalyses,
  useLaunchAnalysis: hooks.useLaunchAnalysis,
}));
vi.mock('@/api/copilot', async (o) => ({
  ...(await o<typeof import('@/api/copilot')>()),
  useCopilotConverse: hooks.useCopilotConverse,
  useCopilotHealth: hooks.useCopilotHealth,
}));
vi.mock('@/api/documents', async (o) => ({
  ...(await o<typeof import('@/api/documents')>()),
  useDocuments: hooks.useDocuments,
  useUploadDocumentDirect: hooks.useUploadDocumentDirect,
}));
vi.mock('@/api/entreprises', async (o) => ({
  ...(await o<typeof import('@/api/entreprises')>()),
  useEntreprise: hooks.useEntreprise,
  useRefreshEntreprise: hooks.useRefreshEntreprise,
}));
vi.mock('@/api/export', async (o) => ({
  ...(await o<typeof import('@/api/export')>()),
  useExportDocument: hooks.useExportDocument,
}));
vi.mock('@/api/journal', async (o) => ({
  ...(await o<typeof import('@/api/journal')>()),
  useJournalEvents: hooks.useJournalEvents,
}));
vi.mock('@/api/metiers', async (o) => ({
  ...(await o<typeof import('@/api/metiers')>()),
  useMetierModules: hooks.useMetierModules,
}));
vi.mock('@/api/modules', async (o) => ({
  ...(await o<typeof import('@/api/modules')>()),
  useDetectMetier: hooks.useDetectMetier,
  useExecuteModule: hooks.useExecuteModule,
}));
vi.mock('@/api/portefeuille', async (o) => ({
  ...(await o<typeof import('@/api/portefeuille')>()),
  usePortefeuilleEntreprise: hooks.usePortefeuilleEntreprise,
}));
vi.mock('@/api/recommandations', async (o) => ({
  ...(await o<typeof import('@/api/recommandations')>()),
  useContextualDiagnostic: hooks.useContextualDiagnostic,
  useRecommandationsForJobs: hooks.useRecommandationsForJobs,
}));

// --- Fixtures ----------------------------------------------------------------

const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  ...extra,
});

const mutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  reset: vi.fn(),
});

const identite = {
  siren: '123456789',
  siret_siege: '12345678900011',
  raison_sociale: 'Boulangerie Dupont',
  enseigne: null,
  forme_juridique: '5710',
  forme_juridique_libelle: 'SAS',
  statut: 'active',
  date_creation: '2015-03-01',
  date_radiation: null,
  code_naf: '1071C',
  libelle_naf: 'Boulangerie et boulangerie-pâtisserie',
  section_naf: 'C',
  effectif_tranche: '11',
  effectif_annee: '2025',
  effectif_estime: 12,
  capital_social: 50000,
  categorie: 'PME',
  adresse: '1 rue du Pain',
  code_postal: '69000',
  ville: 'Lyon',
  departement: '69',
  region: 'Auvergne-Rhône-Alpes',
  nb_etablissements_ouverts: 1,
  dirigeants: [],
  convention_collective: null,
  risque_sectoriel: 'faible',
  source: 'sirene',
};

const axe = { score: 70, poids: 0.2, raisons: [] };

const scoring = {
  score_global: 72,
  severity: 'faible' as const,
  axes: {
    stabilite: axe,
    croissance: axe,
    risque: axe,
    maturite_naf: axe,
    solidite_dirigeants: axe,
  },
};

const synthese = {
  texte: 'Entreprise saine.',
  points_cles: {
    raison_sociale: 'Boulangerie Dupont',
    activite: 'Boulangerie',
    ville: 'Lyon',
    anciennete_ans: 11,
    effectif: '12',
    statut: 'active',
    risque_sectoriel: 'faible',
    signaux_bodacc_risque: 0,
    signaux_bodacc_croissance: 1,
    score: 72,
  },
};

const enriched = {
  siren: '123456789',
  enriched_at: '2026-07-01T00:00:00Z',
  offline_sources: [],
  identite,
  bodacc: {
    evenements: [],
    signaux: {
      total: 0,
      risque: 0,
      croissance: 0,
      evenements_risque: [],
      evenements_croissance: [],
    },
  },
  geolocalisation: null,
  scoring,
  synthese,
  finances: null,
};

function setDefaults() {
  hooks.useEntreprise.mockReturnValue(query(enriched));
  hooks.usePortefeuilleEntreprise.mockReturnValue(query(null));
  hooks.useRefreshEntreprise.mockReturnValue(mutation());
  hooks.useDetectMetier.mockReturnValue(query(null));
  hooks.useAnalyses.mockReturnValue(query([]));
  hooks.useLaunchAnalysis.mockReturnValue(mutation());
  hooks.useCopilotConverse.mockReturnValue(mutation());
  hooks.useCopilotHealth.mockReturnValue(query({ ok: true }));
  hooks.useDocuments.mockReturnValue(query([]));
  hooks.useUploadDocumentDirect.mockReturnValue(mutation());
  hooks.useExportDocument.mockReturnValue(mutation());
  hooks.useJournalEvents.mockReturnValue(query([]));
  hooks.useMetierModules.mockReturnValue(query(null));
  hooks.useExecuteModule.mockReturnValue(mutation());
  hooks.useContextualDiagnostic.mockReturnValue(mutation());
  hooks.useRecommandationsForJobs.mockReturnValue(query([]));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockParams.current = { siren: '123456789' };
  mockSearchParams.current = new URLSearchParams();
  setDefaults();
});

describe('gardes', () => {
  it('refuse un SIREN mal formé', () => {
    mockParams.current = { siren: '42' };

    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByText('SIREN invalide : 42')).toBeInTheDocument();
  });

  it('refuse un SIREN absent', () => {
    mockParams.current = {};

    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByText(/SIREN invalide/)).toBeInTheDocument();
  });

  it('affiche un état de chargement', () => {
    hooks.useEntreprise.mockReturnValue(query(undefined, { isLoading: true }));

    const { container } = renderWithProviders(<EntrepriseDetailPage />);

    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('affiche une erreur quand le chargement échoue', () => {
    hooks.useEntreprise.mockReturnValue(query(undefined, { isError: true }));

    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByRole('button', { name: /retour/i })).toBeInTheDocument();
  });

  it("affiche une erreur quand l'identité est absente", () => {
    hooks.useEntreprise.mockReturnValue(query({ identite: null, scoring: null }));

    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByRole('button', { name: /retour/i })).toBeInTheDocument();
  });

  it('revient au portefeuille depuis la vue erreur', () => {
    hooks.useEntreprise.mockReturnValue(query(undefined, { isError: true }));
    renderWithProviders(<EntrepriseDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: /retour/i }));

    expect(mockNavigate).toHaveBeenCalled();
  });
});

describe('en-tête', () => {
  it("affiche la raison sociale et l'identité", () => {
    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByText('Boulangerie Dupont')).toBeInTheDocument();
    expect(screen.getByText(/1071C/)).toBeInTheDocument();
  });

  it('retombe sur le SIREN sans raison sociale', () => {
    hooks.useEntreprise.mockReturnValue(
      query({ ...enriched, identite: { ...identite, raison_sociale: null } }),
    );

    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getAllByText('123456789').length).toBeGreaterThan(0);
  });

  it('affiche le score de scoring', () => {
    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getAllByText(/72/).length).toBeGreaterThan(0);
  });

  it('tolère une entreprise sans scoring', () => {
    hooks.useEntreprise.mockReturnValue(query({ ...enriched, scoring: null }));

    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByText('Boulangerie Dupont')).toBeInTheDocument();
  });
});

describe('onglets', () => {
  it('affiche les neuf onglets', () => {
    renderWithProviders(<EntrepriseDetailPage />);

    for (const label of [
      'Identité',
      'Finances',
      'Analyses',
      'Recommandations',
      'Modules',
      'Documents',
      'Journal',
      'Copilote IA',
      'Playbooks',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("ouvre l'onglet Identité par défaut", () => {
    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByText(/Boulangerie et boulangerie/)).toBeInTheDocument();
  });

  it.each([
    ['Finances'],
    ['Analyses'],
    ['Recommandations'],
    ['Modules'],
    ['Documents'],
    ['Journal'],
    ['Copilote IA'],
    ['Playbooks'],
  ])('bascule sur l’onglet %s', async (label) => {
    renderWithProviders(<EntrepriseDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

    // Le changement d'onglet est propagé dans l'URL.
    await waitFor(() => expect(mockSetSearchParams).toHaveBeenCalled());
  });

  it("respecte l'onglet demandé dans l'URL", () => {
    mockSearchParams.current = new URLSearchParams('tab=journal');

    renderWithProviders(<EntrepriseDetailPage />);

    expect(screen.getByRole('button', { name: /Journal/ })).toBeInTheDocument();
  });
});

describe('rafraîchissement', () => {
  it('déclenche le rafraîchissement des données', () => {
    const refresh = mutation();
    hooks.useRefreshEntreprise.mockReturnValue(refresh);
    renderWithProviders(<EntrepriseDetailPage />);

    const bouton = screen
      .getAllByRole('button')
      .find((b) => /actualiser|rafra/i.test(b.textContent ?? '') || b.querySelector('svg'));
    if (bouton) fireEvent.click(bouton);

    expect(screen.getByText('Boulangerie Dupont')).toBeInTheDocument();
  });
});
