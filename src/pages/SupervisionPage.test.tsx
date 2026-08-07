import '@testing-library/jest-dom';
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type { AiAlert, AiUsage, KpiSnapshot, PmeHealth } from '@/api/admin';
import type { SireneImportStatus } from '@/api/sirene';
import SupervisionPage from './SupervisionPage';

/**
 * Tests de la supervision : cinq onglets indépendants (santé IA, alertes,
 * KPIs, usage IA, base Sirene), chacun avec ses états de chargement, vide et
 * d'erreur.
 *
 * Les hooks TanStack Query sont doublés en bloc : ce qui est vérifié ici,
 * c'est ce que l'exploitant voit, pas la couche réseau.
 */

const admin = vi.hoisted(() => ({
  usePmeHealth: vi.fn(),
  useAiAlerts: vi.fn(),
  usePatchAiAlert: vi.fn(),
  useKpiSnapshots: vi.fn(),
  useAiUsages: vi.fn(),
  parseAdminJsonObject: vi.fn(),
}));
const sirene = vi.hoisted(() => ({
  useSireneImportStatus: vi.fn(),
  useSireneStats: vi.fn(),
  useStartSireneImport: vi.fn(),
}));

vi.mock('@/api/admin', () => admin);
vi.mock('@/api/sirene', () => sirene);

const sante = (overrides: Partial<PmeHealth> = {}): PmeHealth => ({
  backend_status: 'UP',
  ollama_status: 'ready',
  model: 'mistral:7b',
  local_ai_ready: true,
  user_message: null,
  ...overrides,
});

const alerte = (overrides: Partial<AiAlert> = {}): AiAlert =>
  ({
    id: 12,
    kind: 'TRESORERIE',
    severity: 'HIGH',
    title: 'Solde projeté négatif',
    summary: 'Le solde passe sous zéro dans 18 jours.',
    rationale: null,
    confidence: 0.76,
    signals: null,
    sources: null,
    suggestedAction: 'Relancer les impayés de plus de 30 jours.',
    relatedSiren: '552100554',
    relatedJobId: null,
    status: 'new',
    createdAt: '2026-08-01T09:00:00Z',
    seenAt: null,
    actedAt: null,
    dismissedAt: null,
    snoozeUntil: null,
    expiresAt: null,
    tenant: { id: 1 },
    user: null,
    ...overrides,
  }) as AiAlert;

const kpi = (overrides: Partial<KpiSnapshot> = {}): KpiSnapshot =>
  ({
    id: 3,
    kpi: 'analyses_count',
    granularity: 'day',
    periodStart: '2026-08-01T00:00:00Z',
    periodEnd: '2026-08-02T00:00:00Z',
    value: 1240,
    valuePrev: 1000,
    metadataJson: null,
    createdAt: '2026-08-02T01:00:00Z',
    tenant: { id: 1 },
    ...overrides,
  }) as KpiSnapshot;

const usage = (overrides: Partial<AiUsage> = {}): AiUsage =>
  ({
    id: 5,
    requestId: 'req-1',
    provider: 'ollama',
    model: 'mistral:7b',
    endpoint: '/generate',
    promptTokens: 120,
    completionTokens: 340,
    totalTokens: 460,
    estimatedCostMicroUsd: 1500,
    latencyMs: 820,
    status: 'ok',
    errorCode: null,
    createdAt: '2026-08-05T10:00:00Z',
    tenant: { id: 1 },
    user: null,
    ...overrides,
  }) as AiUsage;

const importSirene = (
  overrides: Partial<SireneImportStatus> = {},
): SireneImportStatus => ({
  running: false,
  phase: 'idle',
  processed: 0,
  upserted: 0,
  skipped: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

/** Double de requête TanStack Query, réduit à ce que la page consomme. */
function requete(data: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isLoading: false, isFetching: false, refetch: vi.fn(), ...overrides };
}

/** Câble tous les hooks ; chaque test ne surcharge que l'onglet qu'il vise. */
function brancher(o: Record<string, unknown> = {}) {
  const patch = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    variables: undefined,
    ...(o.patch as object),
  };
  const start = {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...(o.start as object),
  };

  admin.usePmeHealth.mockReturnValue(
    requete('health' in o ? o.health : sante(), o.healthQuery as object),
  );
  admin.useAiAlerts.mockReturnValue(
    requete({ content: 'alerts' in o ? o.alerts : [alerte()] }, o.alertsQuery as object),
  );
  admin.usePatchAiAlert.mockReturnValue(patch);
  admin.useKpiSnapshots.mockReturnValue(
    requete('kpis' in o ? o.kpis : [kpi()], o.kpisQuery as object),
  );
  admin.useAiUsages.mockReturnValue(
    requete({ content: 'usages' in o ? o.usages : [usage()] }, o.usagesQuery as object),
  );
  admin.parseAdminJsonObject.mockImplementation((raw: string | null) =>
    raw ? JSON.parse(raw) : null,
  );

  sirene.useSireneImportStatus.mockReturnValue(
    requete('sireneStatus' in o ? o.sireneStatus : importSirene()),
  );
  sirene.useSireneStats.mockReturnValue(
    requete('sireneStats' in o ? o.sireneStats : { actives: 4_200_000, cessees: 1_100_000, total: 5_300_000 }),
  );
  sirene.useStartSireneImport.mockReturnValue(start);

  return { patch, start };
}

const afficher = () => renderWithProviders(<SupervisionPage />);

/** Ouvre l'onglet dont le libellé est donné. */
const ouvrirOnglet = (libelle: string) =>
  fireEvent.click(screen.getByRole('button', { name: libelle }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Supervision — navigation', () => {
  it('propose les cinq onglets et ouvre la santé IA par défaut', () => {
    brancher();

    afficher();

    for (const libelle of ['Santé AI', 'Alertes', 'KPIs', 'Usage IA', 'Base Sirene']) {
      expect(screen.getByRole('button', { name: libelle })).toBeInTheDocument();
    }
    expect(screen.getByText(/Rafraîchi automatiquement/)).toBeInTheDocument();
  });

  it('bascule d’un onglet à l’autre', () => {
    brancher();
    afficher();

    ouvrirOnglet('KPIs');
    expect(screen.getByPlaceholderText('ex. analyses_count')).toBeInTheDocument();

    ouvrirOnglet('Usage IA');
    expect(screen.getByPlaceholderText('ollama, openai…')).toBeInTheDocument();
  });
});

describe('Supervision — santé IA', () => {
  it('restitue l’état du backend et du modèle local', () => {
    brancher();

    afficher();

    expect(screen.getByText('UP')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('mistral:7b')).toBeInTheDocument();
    expect(screen.getByText('Oui')).toBeInTheDocument();
  });

  it('affiche des tirets quand le modèle n’est pas renseigné', () => {
    brancher({ health: sante({ model: null, local_ai_ready: false }) });

    afficher();

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Non')).toBeInTheDocument();
  });

  it('relaie le message destiné à l’exploitant', () => {
    brancher({
      health: sante({
        ollama_status: 'model_missing',
        user_message: 'Le modèle mistral:7b doit être téléchargé.',
      }),
    });

    afficher();

    expect(
      screen.getByText('Le modèle mistral:7b doit être téléchargé.'),
    ).toBeInTheDocument();
  });

  it('distingue un backend dégradé d’un backend sain', () => {
    brancher({ health: sante({ backend_status: 'DEGRADED', ollama_status: 'unreachable' }) });

    afficher();

    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
    expect(screen.getByText('unreachable')).toBeInTheDocument();
  });

  it('signale le chargement de l’état', () => {
    brancher({ healthQuery: { isLoading: true } });

    afficher();

    expect(screen.getByText('Récupération de l’état IA…')).toBeInTheDocument();
  });

  it('invite à réessayer quand l’endpoint ne répond pas', () => {
    brancher({ health: undefined });

    afficher();

    expect(screen.getByText('État indisponible')).toBeInTheDocument();
  });

  it('recharge l’état à la demande', () => {
    brancher();
    const refetch = admin.usePmeHealth.mock.results[0]?.value.refetch;
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));

    expect(refetch ?? admin.usePmeHealth.mock.results[0].value.refetch).toHaveBeenCalled();
  });
});

describe('Supervision — alertes', () => {
  const ouvrir = () => {
    afficher();
    ouvrirOnglet('Alertes');
  };

  it('détaille l’alerte, son motif et le SIREN concerné', () => {
    brancher();

    ouvrir();

    expect(screen.getByText('Solde projeté négatif')).toBeInTheDocument();
    expect(screen.getByText(/Relancer les impayés/)).toBeInTheDocument();
    expect(screen.getByText(/552100554/)).toBeInTheDocument();
    expect(screen.getByText('76%')).toBeInTheDocument();
  });

  it('retombe sur le type quand l’alerte n’a pas de titre', () => {
    brancher({ alerts: [alerte({ title: null, summary: null, suggestedAction: null, relatedSiren: null })] });

    ouvrir();

    expect(
      screen.getByRole('heading', { name: 'TRESORERIE' }),
    ).toBeInTheDocument();
  });

  it('compte une confiance absente comme nulle', () => {
    brancher({ alerts: [alerte({ confidence: undefined as unknown as number })] });

    ouvrir();

    // Sans le repli `?? 0`, la fiche afficherait « NaN% ».
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('marque l’alerte comme vue', async () => {
    const { patch } = brancher();

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Vue' }));

    expect(patch.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, status: 'seen' }),
    );
  });

  it('marque l’alerte comme traitée', () => {
    const { patch } = brancher();

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    expect(patch.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, status: 'acted' }),
    );
  });

  it('écarte l’alerte', () => {
    const { patch } = brancher();

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Écarter/ }));

    expect(patch.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, status: 'dismissed' }),
    );
  });

  it('remonte le message d’erreur du backend', async () => {
    brancher({
      patch: {
        mutateAsync: vi.fn().mockRejectedValue({
          response: { data: { error: { message: 'Alerte déjà traitée' } } },
        }),
      },
    });

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Alerte déjà traitée');
  });

  it('retombe sur le statut HTTP quand le corps d’erreur est muet', async () => {
    brancher({
      patch: {
        mutateAsync: vi.fn().mockRejectedValue({ response: { statusText: 'Conflict' } }),
      },
    });

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conflict');
  });

  it('retombe sur un message générique pour une erreur sans réponse HTTP', async () => {
    brancher({ patch: { mutateAsync: vi.fn().mockRejectedValue(new Error('offline')) } });

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une erreur est survenue. Réessayez.',
    );
  });

  it('désactive les actions déjà effectuées', () => {
    brancher({
      alerts: [
        alerte({ status: 'acted', seenAt: '2026-08-02T09:00:00Z', actedAt: '2026-08-02T10:00:00Z' }),
      ],
    });

    ouvrir();

    expect(screen.getByRole('button', { name: 'Vue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Traiter/ })).toBeDisabled();
    // « Traitée » figure deux fois : en badge de statut et en intitulé de date.
    expect(screen.getAllByText('Traitée')).toHaveLength(2);
  });

  it('affiche « Écartée » pour une alerte écartée', () => {
    brancher({ alerts: [alerte({ status: 'dismissed', dismissedAt: '2026-08-02T10:00:00Z' })] });

    ouvrir();

    expect(screen.getByText('Écartée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Écarter/ })).toBeDisabled();
  });

  it('filtre par sévérité', () => {
    brancher();

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Critiques' }));

    expect(admin.useAiAlerts).toHaveBeenLastCalledWith('CRITICAL', undefined);
  });

  it('filtre par statut', () => {
    brancher();

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelles' }));

    expect(admin.useAiAlerts).toHaveBeenLastCalledWith(undefined, 'new');
  });

  it('signale le chargement puis l’absence d’alerte', () => {
    brancher({ alerts: [], alertsQuery: { isLoading: true } });

    ouvrir();

    expect(screen.getByText('Chargement des alertes…')).toBeInTheDocument();
  });

  it('annonce qu’aucune alerte ne correspond aux filtres', () => {
    brancher({ alerts: [] });

    ouvrir();

    expect(screen.getByText('Aucune alerte')).toBeInTheDocument();
  });
});

describe('Supervision — KPIs', () => {
  const ouvrir = () => {
    afficher();
    ouvrirOnglet('KPIs');
  };

  it('affiche la valeur et la variation par rapport à la période précédente', () => {
    brancher();

    ouvrir();

    expect(screen.getByText('1 240')).toBeInTheDocument();
    expect(screen.getByText('+24.0%')).toBeInTheDocument();
  });

  it('affiche une variation négative sans signe superflu', () => {
    brancher({ kpis: [kpi({ value: 800, valuePrev: 1000 })] });

    ouvrir();

    expect(screen.getByText('-20.0%')).toBeInTheDocument();
  });

  it('omet la variation quand il n’y a pas de période précédente', () => {
    brancher({ kpis: [kpi({ valuePrev: null })] });

    ouvrir();

    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('évite la division par zéro sur une période précédente nulle', () => {
    brancher({ kpis: [kpi({ value: 50, valuePrev: 0 })] });

    ouvrir();

    // `valuePrev || 1` protège le calcul : le pourcentage doit rester fini.
    expect(document.body.textContent).not.toContain('Infinity');
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('affiche les métadonnées quand il y en a', () => {
    brancher({ kpis: [kpi({ metadataJson: '{"source":"batch"}' })] });

    ouvrir();

    expect(screen.getByText(/"source": "batch"/)).toBeInTheDocument();
  });

  it('propose les indicateurs présents en raccourci de filtre', () => {
    brancher({ kpis: [kpi(), kpi({ id: 4, kpi: 'tokens_total' })] });

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'tokens_total' }));

    expect(admin.useKpiSnapshots).toHaveBeenLastCalledWith('tokens_total', undefined);
  });

  it('filtre par indicateur et granularité saisis', () => {
    brancher();

    ouvrir();
    fireEvent.change(screen.getByPlaceholderText('ex. analyses_count'), {
      target: { value: 'analyses_count' },
    });
    fireEvent.change(screen.getByPlaceholderText('day, month…'), {
      target: { value: 'month' },
    });

    expect(admin.useKpiSnapshots).toHaveBeenLastCalledWith('analyses_count', 'month');
  });

  it('signale le chargement des KPIs', () => {
    brancher({ kpis: [], kpisQuery: { isLoading: true } });

    ouvrir();

    expect(screen.getByText('Chargement des KPIs…')).toBeInTheDocument();
  });

  it('annonce l’absence d’instantané', () => {
    brancher({ kpis: [] });

    ouvrir();

    expect(screen.getByText('Aucun KPI')).toBeInTheDocument();
  });
});

describe('Supervision — usage IA', () => {
  const ouvrir = () => {
    afficher();
    ouvrirOnglet('Usage IA');
  };

  it('détaille chaque appel modèle', () => {
    brancher();

    ouvrir();

    expect(screen.getByText('ollama')).toBeInTheDocument();
    expect(screen.getByText('460')).toBeInTheDocument();
    expect(screen.getByText('820 ms')).toBeInTheDocument();
    expect(screen.getByText('1 500')).toBeInTheDocument();
  });

  it('affiche des tirets pour les mesures non renseignées', () => {
    brancher({
      usages: [
        usage({ totalTokens: null, latencyMs: null, estimatedCostMicroUsd: null }),
      ],
    });

    ouvrir();

    const ligne = screen.getByText('ollama').closest('tr') as HTMLElement;
    expect(within(ligne).getAllByText('—')).toHaveLength(3);
  });

  it('distingue un appel en erreur d’un appel réussi', () => {
    brancher({ usages: [usage({ status: 'error' }), usage({ id: 6, status: 'inconnu' })] });

    ouvrir();

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('inconnu')).toBeInTheDocument();
  });

  it('filtre par provider et statut', () => {
    brancher();

    ouvrir();
    fireEvent.change(screen.getByPlaceholderText('ollama, openai…'), {
      target: { value: 'openai' },
    });
    fireEvent.change(screen.getByPlaceholderText('ok, error…'), {
      target: { value: 'error' },
    });

    expect(admin.useAiUsages).toHaveBeenLastCalledWith('openai', 'error');
  });

  it('signale le chargement de l’usage', () => {
    brancher({ usages: [], usagesQuery: { isLoading: true } });

    ouvrir();

    expect(screen.getByText('Chargement de l’usage IA…')).toBeInTheDocument();
  });

  it('annonce l’absence de consommation', () => {
    brancher({ usages: [] });

    ouvrir();

    expect(screen.getByText('Aucune consommation')).toBeInTheDocument();
  });
});

describe('Supervision — base Sirene', () => {
  const ouvrir = () => {
    afficher();
    ouvrirOnglet('Base Sirene');
  };

  it('affiche les volumes en base', () => {
    brancher();

    ouvrir();

    expect(screen.getByText('4 200 000')).toBeInTheDocument();
    expect(screen.getByText('5 300 000')).toBeInTheDocument();
  });

  it('affiche des tirets tant que les volumes ne sont pas connus', () => {
    brancher({ sireneStats: undefined });

    ouvrir();

    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('lance l’import', () => {
    const { start } = brancher();

    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l’import/ }));

    expect(start.mutate).toHaveBeenCalled();
  });

  it('empêche de relancer un import déjà en cours', () => {
    brancher({ sireneStatus: importSirene({ running: true, phase: 'downloading' }) });

    ouvrir();

    expect(screen.getByRole('button', { name: /Import en cours…/ })).toBeDisabled();
    expect(screen.getByText('Téléchargement du stock INSEE…')).toBeInTheDocument();
  });

  it('détaille l’avancement de l’import', () => {
    brancher({
      sireneStatus: importSirene({
        running: true,
        phase: 'parsing',
        processed: 1_500_000,
        upserted: 1_400_000,
        skipped: 100_000,
        startedAt: '2026-08-05T08:00:00Z',
      }),
    });

    ouvrir();

    expect(screen.getByText(/1 500 000/)).toBeInTheDocument();
    expect(screen.getByText(/Démarré/)).toBeInTheDocument();
  });

  it('affiche la date de fin d’un import terminé', () => {
    brancher({
      sireneStatus: importSirene({
        phase: 'done',
        startedAt: '2026-08-05T08:00:00Z',
        finishedAt: '2026-08-05T09:30:00Z',
      }),
    });

    ouvrir();

    expect(screen.getByText(/Terminé :/)).toBeInTheDocument();
  });

  it('reprend tel quel une phase inconnue du référentiel', () => {
    brancher({ sireneStatus: importSirene({ phase: 'verifying' as never }) });

    ouvrir();

    expect(screen.getByText('verifying')).toBeInTheDocument();
  });

  it('masque le suivi tant que l’import n’a jamais tourné', () => {
    brancher();

    ouvrir();

    expect(screen.queryByText(/Lignes traitées/)).not.toBeInTheDocument();
  });

  it('affiche l’erreur remontée par l’import', () => {
    brancher({
      sireneStatus: importSirene({ phase: 'error', error: 'Fichier INSEE introuvable' }),
    });

    ouvrir();

    expect(screen.getByRole('alert')).toHaveTextContent('Fichier INSEE introuvable');
  });

  it('affiche l’échec du démarrage de l’import', () => {
    brancher({
      start: {
        isError: true,
        error: { response: { data: { error: { message: 'Import déjà planifié' } } } },
      },
    });

    ouvrir();

    expect(screen.getByRole('alert')).toHaveTextContent('Import déjà planifié');
  });
});
