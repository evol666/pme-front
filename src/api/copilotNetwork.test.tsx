import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  chatKeys,
  copilotKeys,
  useArchiveChat,
  useChatMessages,
  useChats,
  useCopilotConverse,
  useCopilotHealth,
  useCopilotState,
  useCreateChat,
  useSendChatMessage,
  useUnarchiveChat,
  useUpdateChatTitle,
} from './copilot';
import {
  networkKeys,
  parseJsonObject,
  useBusinessEntities,
  useConnections,
  useCreateBusinessEntity,
  useDeleteBusinessEntity,
  useDeleteConnection,
  useDeleteNetworkInsight,
  useNetworkInsights,
  useNetworkSyncStates,
} from './network';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const wrapper = () => createTestWrapper();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosClient.get).mockResolvedValue({ data: [] } as never);
  vi.mocked(axiosClient.post).mockResolvedValue({ data: { id: 'x' } } as never);
  vi.mocked(axiosClient.put).mockResolvedValue({ data: { id: 'x' } } as never);
  vi.mocked(axiosClient.delete).mockResolvedValue({ data: null } as never);
});

describe('copilotKeys / chatKeys', () => {
  it('compose les clés du copilote', () => {
    expect(copilotKeys.all).toEqual(['copilot']);
    expect(copilotKeys.health).toEqual(['copilot', 'health']);
    expect(copilotKeys.state({ jobId: 'j1' })).toEqual([
      'copilot',
      'state',
      { jobId: 'j1' },
    ]);
  });

  it('compose les clés de conversation', () => {
    expect(chatKeys.list()).toEqual(['copilot', 'chats', 'list']);
    expect(chatKeys.detail('c1')).toEqual(['copilot', 'chats', 'c1']);
    expect(chatKeys.messages('c1')).toEqual(['copilot', 'chats', 'c1', 'messages']);
  });
});

describe('useCopilotState', () => {
  it('traduit les paramètres en snake_case', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: {} } as never);

    const { result } = renderHook(
      () =>
        useCopilotState({
          maxSuggestions: 5,
          maxInsights: 3,
          jobId: 'job-1',
          metierId: 'garagiste',
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/copilot/state', {
      params: {
        max_suggestions: 5,
        max_insights: 3,
        job_id: 'job-1',
        metier_id: 'garagiste',
      },
    });
  });

  it('accepte un appel sans paramètre', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: {} } as never);

    const { result } = renderHook(() => useCopilotState(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/copilot/state', {
      params: {
        max_suggestions: undefined,
        max_insights: undefined,
        job_id: undefined,
        metier_id: undefined,
      },
    });
  });
});

describe('useCopilotHealth', () => {
  it("interroge l'état du copilote", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { ok: true } } as never);

    const { result } = renderHook(() => useCopilotHealth(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/copilot/health');
  });

  it('reste inactif quand il est désactivé', () => {
    const { result } = renderHook(() => useCopilotHealth(false), {
      wrapper: wrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });
});

describe('useCopilotConverse', () => {
  it('envoie la requête de conversation', async () => {
    const { result } = renderHook(() => useCopilotConverse(), { wrapper: wrapper() });

    result.current.mutate({ message: 'bonjour' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/copilot/converse', {
      message: 'bonjour',
    });
  });

  it("remonte l'échec du backend", async () => {
    vi.mocked(axiosClient.post).mockRejectedValue(new Error('503'));
    const { result } = renderHook(() => useCopilotConverse(), { wrapper: wrapper() });

    result.current.mutate({ message: 'bonjour' } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('conversations persistantes', () => {
  it('liste les conversations', async () => {
    const { result } = renderHook(() => useChats(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/copilot/chats');
  });

  it('tolère une réponse nulle', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: null } as never);

    const { result } = renderHook(() => useChats(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('crée une conversation', async () => {
    const { result } = renderHook(() => useCreateChat(), { wrapper: wrapper() });

    result.current.mutate('Nouvelle discussion' as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/copilot/chats', {
      title: 'Nouvelle discussion',
    });
  });

  it('renomme une conversation', async () => {
    const { result } = renderHook(() => useUpdateChatTitle(), { wrapper: wrapper() });

    result.current.mutate({ chatId: 'c1', title: 'Renommée' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.put).toHaveBeenCalledWith('/api/copilot/chats/c1', {
      title: 'Renommée',
    });
  });

  it('archive puis désarchive une conversation', async () => {
    const archive = renderHook(() => useArchiveChat(), { wrapper: wrapper() });
    archive.result.current.mutate('c1' as never);
    await waitFor(() => expect(archive.result.current.isSuccess).toBe(true));

    const unarchive = renderHook(() => useUnarchiveChat(), { wrapper: wrapper() });
    unarchive.result.current.mutate('c1' as never);
    await waitFor(() => expect(unarchive.result.current.isSuccess).toBe(true));

    expect(axiosClient.put).toHaveBeenCalledWith('/api/copilot/chats/c1/archive');
    expect(axiosClient.put).toHaveBeenCalledWith('/api/copilot/chats/c1/unarchive');
  });

  it("reste inactif sans conversation sélectionnée", () => {
    const { result } = renderHook(() => useChatMessages(null), { wrapper: wrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it("charge les messages d'une conversation", async () => {
    const { result } = renderHook(() => useChatMessages('c1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/copilot/chats/c1/messages');
  });

  it('envoie un message avec sa température', async () => {
    const { result } = renderHook(() => useSendChatMessage(), { wrapper: wrapper() });

    result.current.mutate({ chatId: 'c1', message: 'salut', temperature: 0.2 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/copilot/chats/c1/messages', {
      message: 'salut',
      temperature: 0.2,
    });
  });
});

describe('networkKeys', () => {
  it('expose une racine commune', () => {
    expect(networkKeys.all).toEqual(['network']);
  });
});

describe('entités métier', () => {
  it('liste sans filtre', async () => {
    const { result } = renderHook(() => useBusinessEntities(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/business-entities', {
      params: {},
    });
  });

  it('filtre par type et libellé', async () => {
    const { result } = renderHook(() => useBusinessEntities('CLIENT', 'Dupont'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/business-entities', {
      params: { 'kind.equals': 'CLIENT', 'label.contains': 'Dupont' },
    });
  });

  it('crée une entité', async () => {
    const { result } = renderHook(() => useCreateBusinessEntity(), {
      wrapper: wrapper(),
    });

    result.current.mutate({ kind: 'CLIENT', label: 'Dupont' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/business-entities', {
      kind: 'CLIENT',
      label: 'Dupont',
    });
  });

  it('supprime une entité', async () => {
    const { result } = renderHook(() => useDeleteBusinessEntity(), {
      wrapper: wrapper(),
    });

    result.current.mutate(3 as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/business-entities/3');
  });
});

describe('connexions et insights', () => {
  it('filtre les connexions', async () => {
    const { result } = renderHook(() => useConnections('google', 'ACTIVE' as never), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/connections', {
      params: { 'provider.equals': 'google', 'status.equals': 'ACTIVE' },
    });
  });

  it('supprime une connexion', async () => {
    const { result } = renderHook(() => useDeleteConnection(), { wrapper: wrapper() });

    result.current.mutate(4 as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/connections/4');
  });

  it('filtre les insights par type', async () => {
    const { result } = renderHook(() => useNetworkInsights('churn'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/network-insights', {
      params: { 'kind.equals': 'churn' },
    });
  });

  it('supprime un insight', async () => {
    const { result } = renderHook(() => useDeleteNetworkInsight(), {
      wrapper: wrapper(),
    });

    result.current.mutate(5 as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/network-insights/5');
  });

  it('filtre les états de synchronisation', async () => {
    const { result } = renderHook(() => useNetworkSyncStates('google', 'OK'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/network-sync-states', {
      params: { 'provider.equals': 'google', 'status.equals': 'OK' },
    });
  });
});

describe('parseJsonObject', () => {
  it('retourne null pour une valeur vide', () => {
    expect(parseJsonObject(null)).toBeNull();
    expect(parseJsonObject('')).toBeNull();
  });

  it('analyse un objet JSON', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('rejette tableaux, primitives et JSON invalide', () => {
    expect(parseJsonObject('[1]')).toBeNull();
    expect(parseJsonObject('7')).toBeNull();
    expect(parseJsonObject('null')).toBeNull();
    expect(parseJsonObject('{oops')).toBeNull();
  });
});
