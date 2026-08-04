import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  agentsKeys,
  parseJsonArray,
  useAgentMessages,
  useAgentReasoningSteps,
  useAgentRun,
  useAgentRuns,
  useAgentSharedMemory,
  useDeleteAgentRun,
} from './agents';

/**
 * Tests de la couche API des agents : construction des filtres JHipster
 * (`*.contains` / `*.equals`), tri des entités liées, gardes sur les hooks
 * dépendant d'un identifiant, et lecture défensive des champs @Lob.
 */

vi.mock('./axiosClient', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(axiosClient.get);
const del = vi.mocked(axiosClient.delete);

const run = (o: Record<string, unknown> = {}) => ({
  id: 1,
  topic: 'Analyse concurrentielle',
  question: null,
  mode: 'dag',
  agentIds: '["a","b"]',
  status: 'SUCCEEDED',
  error: null,
  durationMs: 1200,
  metadataJson: null,
  createdAt: '2026-08-01T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  tenant: { id: 1 },
  user: null,
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ data: [] } as never);
  del.mockResolvedValue({ data: {} } as never);
});

describe('clés de cache', () => {
  it('distingue les listes par jeu de filtres', () => {
    expect(agentsKeys.runs('a', 'FAILED', 'dag')).not.toEqual(
      agentsKeys.runs('a', 'FAILED', 'debate'),
    );
  });

  it('isole le détail, les messages et le raisonnement d’un run', () => {
    expect(agentsKeys.run(7)).toEqual(['agents', 'runs', 'detail', 7]);
    expect(agentsKeys.messages(7)).toEqual(['agents', 'messages', 7]);
    expect(agentsKeys.reasoning(7)).toEqual(['agents', 'reasoning', 7]);
    expect(agentsKeys.sharedMemory(7)).toEqual(['agents', 'sharedMemory', 7]);
  });
});

describe('liste des runs', () => {
  it('n’envoie aucun filtre par défaut', async () => {
    const { result } = renderHook(() => useAgentRuns(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/agent-runs', { params: {} });
  });

  it('traduit chaque filtre en critère JHipster', async () => {
    const { result } = renderHook(() => useAgentRuns('marché', 'RUNNING', 'debate'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/agent-runs', {
      params: {
        'topic.contains': 'marché',
        'status.equals': 'RUNNING',
        'mode.equals': 'debate',
      },
    });
  });

  it('ignore les filtres vides', async () => {
    const { result } = renderHook(() => useAgentRuns('', undefined, ''), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/agent-runs', { params: {} });
  });

  it('retourne les runs reçus', async () => {
    get.mockResolvedValue({ data: [run()] } as never);

    const { result } = renderHook(() => useAgentRuns(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].topic).toBe('Analyse concurrentielle');
  });
});

describe('détail d’un run', () => {
  it('interroge le run demandé', async () => {
    get.mockResolvedValue({ data: run({ id: 9 }) } as never);

    const { result } = renderHook(() => useAgentRun(9), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/agent-runs/9');
  });

  it('reste inactif sans identifiant', () => {
    const { result } = renderHook(() => useAgentRun(null), {
      wrapper: createTestWrapper(),
    });

    expect(get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('entités liées à un run', () => {
  it('trie les messages par tour puis par date', async () => {
    get.mockResolvedValue({
      data: [
        { id: 3, turn: 2, createdAt: '2026-08-01T10:00:02Z' },
        { id: 1, turn: 1, createdAt: '2026-08-01T10:00:05Z' },
        { id: 2, turn: 1, createdAt: '2026-08-01T10:00:01Z' },
      ],
    } as never);

    const { result } = renderHook(() => useAgentMessages(5), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(m => m.id)).toEqual([2, 1, 3]);
    expect(get).toHaveBeenCalledWith('/api/agent-messages', {
      params: { 'runId.equals': '5' },
    });
  });

  it('trie les étapes de raisonnement chronologiquement', async () => {
    get.mockResolvedValue({
      data: [
        { id: 2, createdAt: '2026-08-01T10:00:09Z' },
        { id: 1, createdAt: '2026-08-01T10:00:01Z' },
      ],
    } as never);

    const { result } = renderHook(() => useAgentReasoningSteps(5), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(s => s.id)).toEqual([1, 2]);
  });

  it('charge la mémoire partagée sans la réordonner', async () => {
    get.mockResolvedValue({ data: [{ id: 2 }, { id: 1 }] } as never);

    const { result } = renderHook(() => useAgentSharedMemory(5), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(m => m.id)).toEqual([2, 1]);
    expect(get).toHaveBeenCalledWith('/api/agent-shared-memories', {
      params: { 'runId.equals': '5' },
    });
  });

  it.each([
    ['messages', useAgentMessages],
    ['raisonnement', useAgentReasoningSteps],
    ['mémoire partagée', useAgentSharedMemory],
  ])('n’interroge pas les %s sans run', (_libelle, hook) => {
    const { result } = renderHook(() => hook(null), {
      wrapper: createTestWrapper(),
    });

    expect(get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('suppression d’un run', () => {
  it('appelle l’API sur l’identifiant fourni', async () => {
    const { result } = renderHook(() => useDeleteAgentRun(), {
      wrapper: createTestWrapper(),
    });

    result.current.mutate(4);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(del).toHaveBeenCalledWith('/api/agent-runs/4');
  });

  it('remonte l’échec du serveur', async () => {
    del.mockRejectedValue(new Error('409'));
    const { result } = renderHook(() => useDeleteAgentRun(), {
      wrapper: createTestWrapper(),
    });

    result.current.mutate(4);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('lecture défensive des champs @Lob', () => {
  it('extrait un tableau de chaînes', () => {
    expect(parseJsonArray('["a","b"]')).toEqual(['a', 'b']);
  });

  it('convertit les éléments non textuels', () => {
    expect(parseJsonArray('[1,true]')).toEqual(['1', 'true']);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['chaîne vide', ''],
  ])('retourne un tableau vide pour %s', (_libelle, valeur) => {
    expect(parseJsonArray(valeur)).toEqual([]);
  });

  it('retourne un tableau vide sur du JSON invalide', () => {
    expect(parseJsonArray('{pas du json')).toEqual([]);
  });

  it('retourne un tableau vide quand le JSON n’est pas un tableau', () => {
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
});
