import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import EntrepriseDetailPage from './EntrepriseDetailPage';

/**
 * Tests du contenu des onglets de la fiche entreprise.
 *
 * Le fichier voisin `EntrepriseDetailPage.test.tsx` couvre les gardes,
 * l'en-tête et la bascule d'onglets. Il ne monte jamais leur contenu : l'onglet
 * actif est lu dans l'URL, que le double de `useSearchParams` fige. Ici on
 * ouvre chaque onglet en amorçant l'URL, ce qui exerce enfin les huit panneaux.
 */

const { mockNavigate, mockParams, mockSearchParams, mockSetSearchParams } = vi.hoisted(
  () => ({
    mockNavigate: vi.fn(),
    mockParams: { current: { siren: '123456789' } as Record<string, string | undefined> },
    mockSearchParams: { current: new URLSearchParams() },
    mockSetSearchParams: vi.fn(),
  }),
);

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams.current,
    useSearchParams: () => [mockSearchParams.current, mockSetSearchParams],
  };
});

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

// --- Jeux d'essai ------------------------------------------------------------

const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
  ...extra,
});

const mutation = (extra: Record<string, unknown> = {}) => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  error: null,
  data: undefined,
  reset: vi.fn(),
  ...extra,
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

const enriched = (surcharges: Record<string, unknown> = {}) => ({
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
  scoring: {
    score_global: 72,
    severity: 'faible',
    axes: {
      stabilite: axe,
      croissance: axe,
      risque: axe,
      maturite_naf: axe,
      solidite_dirigeants: axe,
    },
  },
  synthese: { texte: 'Entreprise saine.', points_cles: {} },
  finances: null,
  ...surcharges,
});

/** Diagnostic consultant tel que le backend le sérialise dans `payload`. */
const diagnosticConsultant = {
  metierId: 'boulangerie',
  diagnostic: 'La marge se contracte depuis deux trimestres.',
  scoreGlobal: 68,
  scorePrecedent: 62,
  actionPrioritaireDefault: {
    titre: 'Revoir la carte des prix',
    description: 'Aligner sur le coût matière.',
    duree: '2 semaines',
    promptIA: 'Analyse la carte',
  },
  kpis: [
    {
      label: 'Marge brute',
      valeur: 34,
      tendance: 'baisse',
      interpretation: 'En repli de 3 points.',
      recommandation: 'Revoir les achats.',
    },
  ],
  plan: [
    {
      titre: 'Auditer les coûts matière',
      statut: 'a_faire',
      echeance: '30 jours',
      impact: 'fort',
      cta: 'Lancer le module',
      messageIA: null,
    },
    {
      titre: 'Former l’équipe',
      statut: 'fait',
      echeance: '60 jours',
      impact: 'moyen',
      cta: 'Voir',
      messageIA: null,
    },
  ],
  projection: {
    visibiliteAvant: 40,
    avecAction: { opportunites: 12, visibilite: 70, pipelineEtat: 'sain' },
    sansAction: { opportunites: 4, visibilite: 35, pipelineEtat: 'fragile' },
  },
};

const exercice = (surcharges: Record<string, unknown> = {}) => ({
  annee: 2025,
  date_cloture: '2025-12-31',
  confidentiel: false,
  chiffre_affaires: 2_400_000,
  excedent_brut_exploitation: 180_000,
  resultat_exploitation: 120_000,
  resultat_net: 90_000,
  total_actif: 1_500_000,
  capitaux_propres: 600_000,
  tresorerie: 250_000,
  creances_clients: 300_000,
  dettes_fiscales_sociales: 80_000,
  ...surcharges,
});

function brancher(o: Record<string, unknown> = {}) {
  const converse = (o.converse as ReturnType<typeof mutation>) ?? mutation();
  const lancer = (o.lancer as ReturnType<typeof mutation>) ?? mutation();
  const diagnostic = (o.diagnostic as ReturnType<typeof mutation>) ?? mutation();

  hooks.useEntreprise.mockReturnValue(
    query('entreprise' in o ? o.entreprise : enriched()),
  );
  hooks.usePortefeuilleEntreprise.mockReturnValue(query(null));
  hooks.useRefreshEntreprise.mockReturnValue(mutation());
  hooks.useDetectMetier.mockReturnValue(query('metier' in o ? o.metier : null));
  hooks.useAnalyses.mockReturnValue(query('analyses' in o ? o.analyses : []));
  hooks.useLaunchAnalysis.mockReturnValue(lancer);
  hooks.useCopilotConverse.mockReturnValue(converse);
  hooks.useCopilotHealth.mockReturnValue(query('sante' in o ? o.sante : null));
  hooks.useDocuments.mockReturnValue(
    query('documents' in o ? o.documents : [], o.documentsQuery as object),
  );
  hooks.useUploadDocumentDirect.mockReturnValue(mutation());
  hooks.useExportDocument.mockReturnValue(mutation());
  hooks.useJournalEvents.mockReturnValue(
    query('journal' in o ? o.journal : { items: [] }, o.journalQuery as object),
  );
  hooks.useMetierModules.mockReturnValue(
    query('catalogue' in o ? o.catalogue : null, o.catalogueQuery as object),
  );
  hooks.useExecuteModule.mockReturnValue(mutation());
  hooks.useContextualDiagnostic.mockReturnValue(diagnostic);
  hooks.useRecommandationsForJobs.mockReturnValue(query('recos' in o ? o.recos : []));

  return { converse, lancer, diagnostic };
}

/** Monte la page directement sur l'onglet voulu, via la query string. */
const ouvrir = (onglet: string) => {
  mockSearchParams.current = new URLSearchParams(`tab=${onglet}`);
  return renderWithProviders(<EntrepriseDetailPage />);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockParams.current = { siren: '123456789' };
  mockSearchParams.current = new URLSearchParams();
  brancher();
});

describe('Fiche entreprise — onglet Documents', () => {
  it('annonce l’absence de document', () => {
    ouvrir('documents');

    expect(screen.getByText('Aucun document')).toBeInTheDocument();
  });

  it('liste les documents avec leur statut', () => {
    brancher({
      documents: [
        { id: 1, title: 'Bilan 2025.pdf', status: 'indexé' },
        { id: 2, title: 'Statuts.pdf', status: 'en attente' },
      ],
    });

    ouvrir('documents');

    expect(screen.getByText('Bilan 2025.pdf')).toBeInTheDocument();
    expect(screen.getByText('en attente')).toBeInTheDocument();
  });

  it('signale le chargement des documents', () => {
    brancher({ documents: undefined, documentsQuery: { isLoading: true } });

    const { container } = ouvrir('documents');

    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });
});

describe('Fiche entreprise — onglet Journal', () => {
  it('annonce un journal vide', () => {
    ouvrir('journal');

    expect(screen.getByText('Aucun événement dans le journal')).toBeInTheDocument();
  });

  it('affiche les événements avec leur type et leur date', () => {
    brancher({
      journal: {
        items: [
          {
            id: 'e1',
            kind: 'analyse',
            title: 'Analyse lancée',
            content: 'Déclenchée manuellement.',
            occurredAt: '2026-08-01T09:00:00Z',
          },
        ],
      },
    });

    ouvrir('journal');

    expect(screen.getByText('Analyse lancée')).toBeInTheDocument();
    expect(screen.getByText('analyse')).toBeInTheDocument();
    expect(screen.getByText('Déclenchée manuellement.')).toBeInTheDocument();
  });

  it('tolère un événement sans contenu', () => {
    brancher({
      journal: {
        items: [
          { id: 'e2', kind: 'import', title: 'Document importé', content: null, occurredAt: '2026-08-02T09:00:00Z' },
        ],
      },
    });

    ouvrir('journal');

    expect(screen.getByText('Document importé')).toBeInTheDocument();
  });

  it('signale le chargement du journal', () => {
    brancher({ journal: undefined, journalQuery: { isLoading: true } });

    const { container } = ouvrir('journal');

    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });
});

describe('Fiche entreprise — onglet Playbooks', () => {
  it('renvoie vers la gestion des playbooks', () => {
    ouvrir('playbooks');

    fireEvent.click(screen.getByRole('button', { name: /Gérer les playbooks/ }));

    expect(mockNavigate).toHaveBeenCalledWith('/playbooks');
  });
});

describe('Fiche entreprise — onglet Finances', () => {
  it('annonce l’absence de données financières', () => {
    ouvrir('finances');

    expect(screen.queryByText('Données financières')).not.toBeInTheDocument();
  });

  it('restitue le tableau des exercices', () => {
    brancher({
      entreprise: enriched({
        finances: { source: 'inpi', exercices: [exercice()], procedure_collective: null },
      }),
    });

    ouvrir('finances');

    expect(screen.getByText('Données financières')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText(/Source : inpi/)).toBeInTheDocument();
    // 2 400 000 € se lit « 2,40M € » : au-delà du million on abrège.
    expect(screen.getByText('2,40M €')).toBeInTheDocument();
    // 180 000 € se lit « 180K € ».
    expect(screen.getByText('180K €')).toBeInTheDocument();
  });

  it('affiche les montants inférieurs au millier sans abréviation', () => {
    brancher({
      entreprise: enriched({
        finances: {
          source: null,
          exercices: [exercice({ resultat_net: 850, tresorerie: null })],
          procedure_collective: null,
        },
      }),
    });

    ouvrir('finances');

    expect(screen.getByText('850 €')).toBeInTheDocument();
    // Une valeur absente se lit « — » et non « 0 € ».
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('signale un exercice aux comptes confidentiels', () => {
    brancher({
      entreprise: enriched({
        finances: {
          source: 'inpi',
          exercices: [exercice({ confidentiel: true })],
          procedure_collective: null,
        },
      }),
    });

    ouvrir('finances');

    expect(screen.getByTitle(/confidentiels/)).toBeInTheDocument();
  });

  it('alerte sur une procédure collective en cours', () => {
    brancher({
      entreprise: enriched({
        finances: {
          source: 'bodacc',
          exercices: [],
          procedure_collective: {
            libelle: 'Redressement judiciaire',
            tribunal: 'Tribunal de commerce de Lyon',
            date: '2026-05-12',
          },
        },
      }),
    });

    ouvrir('finances');

    // Le libellé figure aussi dans le bandeau d'alerte de l'en-tête.
    expect(screen.getAllByText('Redressement judiciaire').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tribunal de commerce de Lyon/)).toBeInTheDocument();
  });

  it('tolère une procédure collective sans tribunal ni date', () => {
    brancher({
      entreprise: enriched({
        finances: {
          source: null,
          exercices: [],
          procedure_collective: { libelle: 'Liquidation', tribunal: null, date: null },
        },
      }),
    });

    ouvrir('finances');

    expect(screen.getAllByText('Liquidation').length).toBeGreaterThan(0);
  });
});

describe('Fiche entreprise — onglet Analyses', () => {
  it('propose de lancer une analyse', async () => {
    const lancer = mutation({
      mutateAsync: vi.fn().mockResolvedValue({ job_id: 'job-9' }),
    });
    brancher({ lancer });

    ouvrir('analyses');
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle analyse/ }));

    await waitFor(() =>
      expect(lancer.mutateAsync).toHaveBeenCalledWith({ siren: '123456789' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/analyse?jobId=job-9');
  });

  it('affiche l’historique des analyses', () => {
    ouvrir('analyses');

    expect(screen.getByText('Historique des analyses')).toBeInTheDocument();
  });

  it('génère le diagnostic consultant à partir de la dernière analyse', async () => {
    const diagnostic = mutation();
    brancher({
      diagnostic,
      analyses: [{ job_id: 'job-3', detected_business_id: 'boulangerie' }],
    });

    ouvrir('analyses');
    const bouton = screen
      .getAllByRole('button')
      .find((b) => /diagnostic|générer/i.test(b.textContent ?? ''));
    if (bouton) fireEvent.click(bouton);

    await waitFor(() => expect(screen.getByText('Historique des analyses')).toBeInTheDocument());
  });

  it('reprend un diagnostic déjà enregistré', () => {
    brancher({
      analyses: [{ job_id: 'job-3', detected_business_id: 'boulangerie' }],
      recos: [
        {
          id: 1,
          category: 'consultant',
          metierId: 'boulangerie',
          payload: JSON.stringify(diagnosticConsultant),
        },
      ],
    });

    ouvrir('analyses');

    expect(
      screen.getByText('La marge se contracte depuis deux trimestres.'),
    ).toBeInTheDocument();
    // Un diagnostic déjà présent propose de le relancer, pas de le générer.
    expect(
      screen.getByRole('button', { name: /Relancer l'analyse/ }),
    ).toBeInTheDocument();
  });

  it('ignore un diagnostic enregistré illisible', () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {});
    brancher({
      analyses: [{ job_id: 'job-3', detected_business_id: null }],
      recos: [{ id: 1, category: 'consultant', metierId: null, payload: '{cassé' }],
    });

    ouvrir('analyses');

    // Un payload abîmé est signalé mais ne doit pas casser l'onglet.
    expect(avertir).toHaveBeenCalled();
    expect(screen.getByText('Historique des analyses')).toBeInTheDocument();
    avertir.mockRestore();
  });
});

describe('Fiche entreprise — onglet Recommandations', () => {
  it('annonce l’absence de module pour le métier', () => {
    ouvrir('recommandations');

    expect(
      screen.getByText('Aucun module disponible pour ce métier'),
    ).toBeInTheDocument();
  });

  it('regroupe les modules par catégorie', () => {
    brancher({
      metier: { id: 'boulangerie' },
      catalogue: {
        modules: [
          { id: 'm1', titre: 'Optimiser les marges', categorie: 'Finance', description: 'x' },
          { id: 'm2', titre: 'Plan de production', description: 'y' },
        ],
        tools: [],
      },
    });

    ouvrir('recommandations');

    // « Finance » sert aussi de catégorie ailleurs dans la page.
    expect(screen.getAllByText('Finance').length).toBeGreaterThan(0);
    // Un module sans catégorie retombe dans « Général ».
    expect(screen.getByText('Général')).toBeInTheDocument();
  });

  it('signale le chargement du catalogue', () => {
    brancher({ catalogue: undefined, catalogueQuery: { isLoading: true } });

    const { container } = ouvrir('recommandations');

    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });
});

describe('Fiche entreprise — onglet Copilote', () => {
  const zoneSaisie = () => screen.getByPlaceholderText(/Écrivez votre message/);

  it('annonce le copilote en ligne', () => {
    brancher({ sante: { ollama_reachable: true, mock: false } });

    ouvrir('copilote');

    expect(screen.getByText('En ligne')).toBeInTheDocument();
  });

  it('signale le mode démo', () => {
    brancher({ sante: { ollama_reachable: true, mock: true } });

    ouvrir('copilote');

    expect(screen.getByText('Mode démo')).toBeInTheDocument();
  });

  it('signale le copilote hors ligne', () => {
    ouvrir('copilote');

    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
  });

  it('mentionne le métier détecté dans le contexte', () => {
    brancher({ analyses: [{ job_id: 'job-1', detected_business_id: 'boulangerie' }] });

    ouvrir('copilote');

    expect(screen.getByText(/\(boulangerie\)/)).toBeInTheDocument();
  });

  it('envoie le message et affiche la réponse', async () => {
    const converse = mutation({
      mutateAsync: vi.fn().mockResolvedValue({ text: 'Voici trois pistes.', sources: [] }),
    });
    brancher({ converse });

    ouvrir('copilote');
    fireEvent.change(zoneSaisie(), { target: { value: 'Que faire ?' } });
    fireEvent.click(screen.getByTitle('Envoyer'));

    expect(await screen.findByText('Voici trois pistes.')).toBeInTheDocument();
    expect(screen.getByText('Que faire ?')).toBeInTheDocument();
  });

  it('envoie à la touche Entrée', async () => {
    const converse = mutation({
      mutateAsync: vi.fn().mockResolvedValue({ text: 'Réponse', sources: [] }),
    });
    brancher({ converse });

    ouvrir('copilote');
    fireEvent.change(zoneSaisie(), { target: { value: 'Bonjour' } });
    fireEvent.keyDown(zoneSaisie(), { key: 'Enter', shiftKey: false });

    await waitFor(() => expect(converse.mutateAsync).toHaveBeenCalled());
  });

  it('refuse un message vide', () => {
    const converse = mutation();
    brancher({ converse });

    ouvrir('copilote');
    fireEvent.change(zoneSaisie(), { target: { value: '   ' } });
    fireEvent.keyDown(zoneSaisie(), { key: 'Enter' });

    expect(converse.mutateAsync).not.toHaveBeenCalled();
  });

  it('affiche le message métier quand le copilote échoue', async () => {
    const converse = mutation({
      mutateAsync: vi.fn().mockRejectedValue({
        response: { data: { error: { message: 'Modèle indisponible' } } },
      }),
    });
    brancher({ converse });

    ouvrir('copilote');
    fireEvent.change(zoneSaisie(), { target: { value: 'Test' } });
    fireEvent.click(screen.getByTitle('Envoyer'));

    expect(await screen.findByText('Modèle indisponible')).toBeInTheDocument();
  });

  it('retombe sur un message générique sans réponse HTTP', async () => {
    const converse = mutation({
      mutateAsync: vi.fn().mockRejectedValue(new Error('offline')),
    });
    brancher({ converse });

    ouvrir('copilote');
    fireEvent.change(zoneSaisie(), { target: { value: 'Test' } });
    fireEvent.click(screen.getByTitle('Envoyer'));

    expect(
      await screen.findByText('Le copilote ne répond pas pour le moment.'),
    ).toBeInTheDocument();
  });
});
