import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type {
  AgentMessage,
  AgentReasoningStep,
  AgentRun,
  AgentSharedMemory,
} from '@/api/agents';
import AgentRunDetailPage from './AgentRunDetailPage';

/**
 * Tests du détail d'un run d'agents : garde sur l'identifiant de route,
 * en-tête, métadonnées et les trois sections liées.
 *
 * La chronologie des messages regroupe par tour et trie par date : c'est la
 * seule logique de la page qui transforme réellement les données, elle est
 * donc vérifiée sur des messages volontairement désordonnés.
 */

const params = vi.hoisted(() => ({ current: { runId: '7' } as { runId?: string } }));
const navMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useParams: () => params.current,
  useNavigate: () => navMock,
}));
vi.mock('sonner', () => ({ toast: toastMock }));

const agents = vi.hoisted(() => ({
  useAgentRun: vi.fn(),
  useAgentMessages: vi.fn(),
  useAgentReasoningSteps: vi.fn(),
  useAgentSharedMemory: vi.fn(),
  useDeleteAgentRun: vi.fn(),
  parseJsonArray: vi.fn(),
}));

vi.mock('@/api/agents', () => agents);

const run = (overrides: Partial<AgentRun> = {}): AgentRun =>
  ({
    id: 7,
    topic: 'Diagnostic trésorerie',
    question: 'Quels leviers activer ce trimestre ?',
    mode: 'debate',
    agentIds: '["analyste","controleur"]',
    status: 'SUCCEEDED',
    error: null,
    durationMs: 4300,
    metadataJson: '{"seed":42}',
    createdAt: '2026-08-01T09:00:00Z',
    startedAt: '2026-08-01T09:00:05Z',
    finishedAt: '2026-08-01T09:00:09Z',
    tenant: { id: 1 },
    user: null,
    ...overrides,
  }) as AgentRun;

const messageAgent = (overrides: Partial<AgentMessage> = {}): AgentMessage =>
  ({
    id: 1,
    turn: 1,
    agentId: 'analyste',
    role: 'assistant',
    kind: 'argument',
    content: 'Le BFR augmente de 12 %.',
    confidence: 0.64,
    references: null,
    attributes: null,
    createdAt: '2026-08-01T09:00:06Z',
    run: { id: 7 },
    tenant: { id: 1 },
    ...overrides,
  }) as AgentMessage;

const etape = (overrides: Partial<AgentReasoningStep> = {}): AgentReasoningStep =>
  ({
    id: 20,
    agentId: 'controleur',
    step: 'verification',
    thought: 'Les encours clients expliquent l’écart.',
    attributes: null,
    createdAt: '2026-08-01T09:00:07Z',
    tenant: { id: 1 },
    run: { id: 7 },
    ...overrides,
  }) as AgentReasoningStep;

const memoire = (overrides: Partial<AgentSharedMemory> = {}): AgentSharedMemory =>
  ({
    id: 30,
    scope: 'run',
    key: 'bfr_delta',
    value: '{"pct":12}',
    ttlSeconds: 3600,
    createdAt: '2026-08-01T09:00:08Z',
    updatedAt: '2026-08-01T09:00:08Z',
    tenant: { id: 1 },
    run: { id: 7 },
    ...overrides,
  }) as AgentSharedMemory;

function requete(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function brancher(o: Record<string, unknown> = {}) {
  const suppression = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    ...(o.suppression as object),
  };
  const refetch = vi.fn();

  agents.useAgentRun.mockReturnValue(
    requete('run' in o ? o.run : run(), { refetch, ...(o.runQuery as object) }),
  );
  agents.useAgentMessages.mockReturnValue(
    requete('messages' in o ? o.messages : [messageAgent()], o.messagesQuery as object),
  );
  agents.useAgentReasoningSteps.mockReturnValue(
    requete('etapes' in o ? o.etapes : [etape()], o.etapesQuery as object),
  );
  agents.useAgentSharedMemory.mockReturnValue(
    requete('memoire' in o ? o.memoire : [memoire()], o.memoireQuery as object),
  );
  agents.useDeleteAgentRun.mockReturnValue(suppression);
  agents.parseJsonArray.mockImplementation((raw: string | null) =>
    raw ? JSON.parse(raw) : [],
  );

  return { suppression, refetch };
}

const afficher = () => renderWithProviders(<AgentRunDetailPage />);

beforeEach(() => {
  vi.clearAllMocks();
  params.current = { runId: '7' };
  vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Détail run — garde sur l’identifiant', () => {
  it('refuse un identifiant non numérique', () => {
    params.current = { runId: 'abc' };
    brancher();

    afficher();

    expect(screen.getByRole('alert')).toHaveTextContent('Identifiant de run invalide.');
    expect(agents.useAgentRun).toHaveBeenCalledWith(null);
  });

  it('refuse un identifiant absent', () => {
    params.current = {};
    brancher();

    afficher();

    expect(screen.getByRole('alert')).toHaveTextContent('Identifiant de run invalide.');
  });

  it('permet de revenir à la liste depuis l’erreur', () => {
    params.current = { runId: 'abc' };
    brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Retour/ }));

    expect(navMock).toHaveBeenCalledWith('/agents');
  });
});

describe('Détail run — chargement', () => {
  it('signale le chargement', () => {
    brancher({ run: undefined, runQuery: { isLoading: true } });

    afficher();

    expect(screen.getByText('Chargement du run…')).toBeInTheDocument();
  });

  it('propose de réessayer après une erreur de chargement', () => {
    const { refetch } = brancher({
      run: undefined,
      runQuery: { isError: true, error: { response: { statusText: 'Bad Gateway' } } },
    });
    afficher();

    expect(screen.getByRole('alert')).toHaveTextContent('Bad Gateway');
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));

    expect(refetch).toHaveBeenCalled();
  });

  it('signale un run introuvable', () => {
    brancher({ run: null });

    afficher();

    expect(screen.getByRole('alert')).toHaveTextContent('Run introuvable.');
  });
});

describe('Détail run — en-tête', () => {
  it('résume statut, mode, durée et date de création', () => {
    brancher();

    afficher();

    expect(screen.getByRole('heading', { name: 'Diagnostic trésorerie' })).toBeInTheDocument();
    expect(screen.getByText('Réussi')).toBeInTheDocument();
    expect(screen.getByText('debate')).toBeInTheDocument();
    expect(screen.getByText('4.3 s')).toBeInTheDocument();
  });

  it('accorde le nombre d’agents au singulier', () => {
    brancher({ run: run({ agentIds: '["analyste"]' }) });

    afficher();

    expect(screen.getByText(/1 agent$/)).toBeInTheDocument();
  });

  it('accorde le nombre d’agents au pluriel', () => {
    brancher();

    afficher();

    expect(screen.getByText(/2 agents$/)).toBeInTheDocument();
  });

  it('affiche la question posée', () => {
    brancher();

    afficher();

    expect(screen.getByText('Quels leviers activer ce trimestre ?')).toBeInTheDocument();
  });

  it('masque la section question quand il n’y en a pas', () => {
    brancher({ run: run({ question: null }) });

    afficher();

    expect(screen.queryByText('Question')).not.toBeInTheDocument();
  });

  it('affiche l’erreur d’un run en échec', () => {
    brancher({ run: run({ status: 'FAILED', error: 'Timeout du modèle' }) });

    afficher();

    expect(screen.getByRole('alert')).toHaveTextContent('Timeout du modèle');
    expect(screen.getByText('Échec')).toBeInTheDocument();
  });

  it('affiche des tirets pour un run jamais démarré', () => {
    brancher({
      run: run({ status: 'PENDING', durationMs: null, startedAt: null, finishedAt: null }),
    });

    afficher();

    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText(/Démarré — · Terminé —/)).toBeInTheDocument();
  });
});

describe('Détail run — métadonnées', () => {
  it('affiche les métadonnées bien formées', () => {
    brancher();

    afficher();

    expect(screen.getByText('Métadonnées')).toBeInTheDocument();
    expect(screen.getByText(/"seed": 42/)).toBeInTheDocument();
  });

  it('ignore des métadonnées mal formées plutôt que de planter', () => {
    brancher({ run: run({ metadataJson: '{ceci n’est pas du JSON' }) });

    afficher();

    expect(screen.queryByText('Métadonnées')).not.toBeInTheDocument();
  });

  it('ignore un JSON valide qui n’est pas un objet', () => {
    brancher({ run: run({ metadataJson: '[1,2,3]' }) });

    afficher();

    // Un tableau ne se rend pas comme un dictionnaire : la section disparaît.
    expect(screen.queryByText('Métadonnées')).not.toBeInTheDocument();
  });

  it('masque la section quand il n’y a pas de métadonnées', () => {
    brancher({ run: run({ metadataJson: null }) });

    afficher();

    expect(screen.queryByText('Métadonnées')).not.toBeInTheDocument();
  });
});

describe('Détail run — actions', () => {
  it('recharge le run', () => {
    const { refetch } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));

    expect(refetch).toHaveBeenCalled();
  });

  it('revient à la liste', () => {
    brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /^Retour/ }));

    expect(navMock).toHaveBeenCalledWith('/agents');
  });

  it('supprime le run puis revient à la liste', async () => {
    const { suppression } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    await waitFor(() => expect(suppression.mutateAsync).toHaveBeenCalledWith(7));
    expect(toastMock.success).toHaveBeenCalledWith('Run supprimé.');
    expect(navMock).toHaveBeenCalledWith('/agents');
  });

  it('ne supprime rien si la confirmation est refusée', () => {
    vi.mocked(globalThis.confirm).mockReturnValue(false);
    const { suppression } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(suppression.mutateAsync).not.toHaveBeenCalled();
  });

  it('reste sur la page quand la suppression échoue', async () => {
    brancher({
      suppression: {
        mutateAsync: vi.fn().mockRejectedValue({
          response: { data: { error: { message: 'Run verrouillé' } } },
        }),
      },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Run verrouillé'));
    expect(navMock).not.toHaveBeenCalledWith('/agents');
  });
});

describe('Détail run — chronologie des messages', () => {
  it('regroupe les messages par tour, dans l’ordre', () => {
    brancher({
      messages: [
        messageAgent({ id: 3, turn: 2, createdAt: '2026-08-01T09:00:20Z' }),
        messageAgent({ id: 1, turn: 1, createdAt: '2026-08-01T09:00:10Z' }),
        messageAgent({ id: 2, turn: 1, createdAt: '2026-08-01T09:00:05Z' }),
      ],
    });

    afficher();

    const tours = screen.getAllByText(/^Tour \d/);
    expect(tours[0]).toHaveTextContent('Tour 1 · 2 messages');
    expect(tours[1]).toHaveTextContent('Tour 2 · 1 message');
  });

  it('accorde le décompte de messages au singulier', () => {
    brancher({ messages: [messageAgent()] });

    afficher();

    expect(screen.getByText('Tour 1 · 1 message')).toBeInTheDocument();
  });

  it('détaille chaque message avec sa confiance', () => {
    brancher();

    afficher();

    expect(screen.getByText('Le BFR augmente de 12 %.')).toBeInTheDocument();
    expect(screen.getByText(/confiance 64%/)).toBeInTheDocument();
  });

  it('omet la confiance et le corps quand ils sont absents', () => {
    brancher({ messages: [messageAgent({ confidence: null, content: null })] });

    afficher();

    expect(screen.queryByText(/confiance/)).not.toBeInTheDocument();
  });

  it('annonce l’absence de message', () => {
    brancher({ messages: [] });

    afficher();

    expect(screen.getByText('Aucun message.')).toBeInTheDocument();
  });

  it('remonte l’erreur de chargement des messages', () => {
    brancher({
      messagesQuery: { isError: true, error: { response: { statusText: 'Gone' } } },
    });

    afficher();

    expect(screen.getByText('Gone')).toBeInTheDocument();
  });

  it('signale le chargement des messages', () => {
    brancher({ messagesQuery: { isLoading: true } });

    afficher();

    expect(screen.getAllByText('Chargement…').length).toBeGreaterThan(0);
  });
});

describe('Détail run — raisonnement et mémoire', () => {
  it('détaille les étapes de raisonnement', () => {
    brancher();

    afficher();

    expect(screen.getByText('verification')).toBeInTheDocument();
    expect(screen.getByText('Les encours clients expliquent l’écart.')).toBeInTheDocument();
  });

  it('annonce l’absence d’étape', () => {
    brancher({ etapes: [] });

    afficher();

    expect(screen.getByText('Aucune étape de raisonnement.')).toBeInTheDocument();
  });

  it('remonte l’erreur de chargement du raisonnement', () => {
    brancher({
      etapesQuery: { isError: true, error: { response: { statusText: 'Forbidden' } } },
    });

    afficher();

    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });

  it('détaille la mémoire partagée', () => {
    brancher();

    afficher();

    expect(screen.getByText('bfr_delta')).toBeInTheDocument();
  });

  it('annonce l’absence de mémoire partagée', () => {
    brancher({ memoire: [] });

    afficher();

    expect(screen.getByText('Aucune mémoire partagée.')).toBeInTheDocument();
  });

  it('compte les éléments de chaque section', () => {
    brancher();

    afficher();

    const titre = screen.getByText('Messages').closest('h2') as HTMLElement;
    expect(within(titre).getByText('(1)')).toBeInTheDocument();
  });
});
