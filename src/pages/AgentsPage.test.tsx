import '@testing-library/jest-dom';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type {
  AgentMessage,
  AgentReasoningStep,
  AgentRun,
  AgentSharedMemory,
} from '@/api/agents';
import AgentsPage from './AgentsPage';

/**
 * Tests des runs d'agents : filtres, suppression confirmée et trace
 * expansible (messages, raisonnement, mémoire partagée).
 *
 * La trace n'est chargée qu'à l'ouverture du détail : c'est là que se joue
 * l'essentiel de l'écran, et rien ne l'exerçait.
 */

const agents = vi.hoisted(() => ({
  useAgentRuns: vi.fn(),
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
    metadataJson: null,
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
    id: 2,
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
    id: 3,
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

/** Double de requête TanStack Query, réduit à ce que la page consomme. */
function requete(data: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isLoading: false, isFetching: false, refetch: vi.fn(), ...overrides };
}

function brancher(o: Record<string, unknown> = {}) {
  const suppression = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    variables: undefined,
    ...(o.suppression as object),
  };
  const refetch = vi.fn();

  agents.useAgentRuns.mockReturnValue(
    requete('runs' in o ? o.runs : [run()], { refetch, ...(o.runsQuery as object) }),
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

const afficher = () => renderWithProviders(<AgentsPage />);

/** Déplie la trace du premier run affiché. */
const ouvrirLaTrace = () =>
  fireEvent.click(screen.getByRole('button', { name: /Voir la trace/ }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Runs d’agents — liste', () => {
  it('détaille le run, son mode et sa durée', () => {
    brancher();

    afficher();

    expect(screen.getByText('Diagnostic trésorerie')).toBeInTheDocument();
    expect(screen.getByText('debate')).toBeInTheDocument();
    expect(screen.getByText('Réussi')).toBeInTheDocument();
    expect(screen.getByText('4.3 s')).toBeInTheDocument();
  });

  it('exprime en millisecondes une durée inférieure à la seconde', () => {
    brancher({ runs: [run({ durationMs: 850 })] });

    afficher();

    expect(screen.getByText('850 ms')).toBeInTheDocument();
  });

  it('affiche des tirets pour un run jamais démarré', () => {
    brancher({
      runs: [run({ status: 'PENDING', durationMs: null, startedAt: null, finishedAt: null })],
    });

    afficher();

    // « En attente » est aussi un libellé de filtre : la carte en ajoute un second.
    expect(screen.getAllByText('En attente')).toHaveLength(2);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('liste les agents mobilisés', () => {
    brancher();

    afficher();

    expect(screen.getByText('analyste')).toBeInTheDocument();
    expect(screen.getByText('controleur')).toBeInTheDocument();
  });

  it('n’affiche aucune pastille quand la liste d’agents est absente', () => {
    brancher({ runs: [run({ agentIds: null, question: null })] });

    afficher();

    expect(screen.queryByText('analyste')).not.toBeInTheDocument();
  });

  it('affiche l’erreur d’un run en échec', () => {
    brancher({ runs: [run({ status: 'FAILED', error: 'Timeout du modèle' })] });

    afficher();

    expect(screen.getByText('Échec')).toBeInTheDocument();
    expect(screen.getByText('Timeout du modèle')).toBeInTheDocument();
  });

  it('signale le chargement des runs', () => {
    brancher({ runs: [], runsQuery: { isLoading: true } });

    afficher();

    expect(screen.getByText('Chargement des runs…')).toBeInTheDocument();
  });

  it('annonce l’absence de run', () => {
    brancher({ runs: [] });

    afficher();

    expect(screen.getByText('Aucun run d’agent')).toBeInTheDocument();
  });
});

describe('Runs d’agents — filtres', () => {
  it('n’applique la recherche qu’à la soumission', () => {
    brancher();
    afficher();

    fireEvent.change(screen.getByPlaceholderText('Sujet du run…'), {
      target: { value: 'trésorerie' },
    });
    // Tant que le formulaire n'est pas soumis, la requête reste inchangée.
    expect(agents.useAgentRuns).toHaveBeenLastCalledWith(undefined, undefined, undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));

    expect(agents.useAgentRuns).toHaveBeenLastCalledWith('trésorerie', undefined, undefined);
  });

  it('ignore les espaces autour du terme recherché', () => {
    brancher();
    afficher();

    fireEvent.change(screen.getByPlaceholderText('Sujet du run…'), {
      target: { value: '  dag  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));

    expect(agents.useAgentRuns).toHaveBeenLastCalledWith('dag', undefined, undefined);
  });

  it('filtre par statut', () => {
    brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Échecs' }));

    expect(agents.useAgentRuns).toHaveBeenLastCalledWith(undefined, 'FAILED', undefined);
  });

  it('filtre par mode d’orchestration', () => {
    brancher();
    afficher();

    fireEvent.change(screen.getByPlaceholderText('dag, debate…'), {
      target: { value: 'dag' },
    });

    expect(agents.useAgentRuns).toHaveBeenLastCalledWith(undefined, undefined, 'dag');
  });

  it('recharge la liste à la demande', () => {
    const { refetch } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));

    expect(refetch).toHaveBeenCalled();
  });
});

describe('Runs d’agents — suppression', () => {
  it('supprime le run après confirmation', () => {
    const { suppression } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Diagnostic trésorerie'),
    );
    expect(suppression.mutateAsync).toHaveBeenCalledWith(7);
  });

  it('ne supprime rien si la confirmation est refusée', () => {
    vi.mocked(globalThis.confirm).mockReturnValue(false);
    const { suppression } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(suppression.mutateAsync).not.toHaveBeenCalled();
  });

  it('remonte le message d’erreur du backend', async () => {
    brancher({
      suppression: {
        mutateAsync: vi.fn().mockRejectedValue({
          response: { data: { error: { message: 'Run verrouillé' } } },
        }),
      },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Run verrouillé');
  });

  it('retombe sur le statut HTTP quand le corps d’erreur est muet', async () => {
    brancher({
      suppression: {
        mutateAsync: vi.fn().mockRejectedValue({ response: { statusText: 'Conflict' } }),
      },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conflict');
  });

  it('retombe sur un message générique sans réponse HTTP', async () => {
    brancher({
      suppression: { mutateAsync: vi.fn().mockRejectedValue(new Error('offline')) },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une erreur est survenue. Réessayez.',
    );
  });

  it('bloque le bouton du run en cours de suppression', () => {
    brancher({ suppression: { isPending: true, variables: 7 } });

    afficher();

    expect(screen.getByRole('button', { name: /Supprimer/ })).toBeDisabled();
  });
});

describe('Runs d’agents — trace', () => {
  it('n’affiche la trace qu’une fois dépliée', () => {
    brancher();
    afficher();

    expect(screen.queryByText('Messages')).not.toBeInTheDocument();

    ouvrirLaTrace();

    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masquer la trace/ })).toBeInTheDocument();
  });

  it('replie la trace', () => {
    brancher();
    afficher();
    ouvrirLaTrace();

    fireEvent.click(screen.getByRole('button', { name: /Masquer la trace/ }));

    expect(screen.queryByText('Messages')).not.toBeInTheDocument();
  });

  it('détaille les messages échangés avec leur confiance', () => {
    brancher();
    afficher();

    ouvrirLaTrace();

    expect(screen.getByText('Tour 1')).toBeInTheDocument();
    expect(screen.getByText('Le BFR augmente de 12 %.')).toBeInTheDocument();
    expect(screen.getByText(/confiance 64%/)).toBeInTheDocument();
  });

  it('omet la confiance quand elle n’est pas calculée', () => {
    brancher({ messages: [messageAgent({ confidence: null, content: null })] });
    afficher();

    ouvrirLaTrace();

    expect(screen.queryByText(/confiance/)).not.toBeInTheDocument();
  });

  it('détaille les étapes de raisonnement', () => {
    brancher();
    afficher();

    ouvrirLaTrace();

    expect(screen.getByText('verification')).toBeInTheDocument();
    expect(screen.getByText('Les encours clients expliquent l’écart.')).toBeInTheDocument();
  });

  it('détaille la mémoire partagée et sa durée de vie', () => {
    brancher();
    afficher();

    ouvrirLaTrace();

    expect(screen.getByText('bfr_delta')).toBeInTheDocument();
    expect(screen.getByText(/TTL 3600s/)).toBeInTheDocument();
  });

  it('omet la durée de vie d’une mémoire permanente', () => {
    brancher({ memoire: [memoire({ ttlSeconds: null, value: null })] });
    afficher();

    ouvrirLaTrace();

    expect(screen.queryByText(/TTL/)).not.toBeInTheDocument();
  });

  it('annonce chaque section vide séparément', () => {
    brancher({ messages: [], etapes: [], memoire: [] });
    afficher();

    ouvrirLaTrace();

    expect(screen.getByText('Aucun message.')).toBeInTheDocument();
    expect(screen.getByText('Aucune étape de raisonnement.')).toBeInTheDocument();
    expect(screen.getByText('Aucune mémoire partagée.')).toBeInTheDocument();
  });

  it('signale le chargement de chaque section', () => {
    brancher({
      messagesQuery: { isLoading: true },
      etapesQuery: { isLoading: true },
      memoireQuery: { isLoading: true },
    });
    afficher();

    ouvrirLaTrace();

    expect(screen.getAllByText('Chargement…')).toHaveLength(3);
  });

  it('compte les éléments de chaque section', () => {
    brancher();
    afficher();

    ouvrirLaTrace();

    const titreMessages = screen.getByText('Messages').closest('h4') as HTMLElement;
    expect(within(titreMessages).getByText('(1)')).toBeInTheDocument();
  });
});
