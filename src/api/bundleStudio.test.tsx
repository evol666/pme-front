import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  extractBackendError,
  formatDateTime,
  parseLobJson,
  STUDIO_PROJECT_STATUS_LABEL,
  studioKeys,
  useCreateStudioAgent,
  useCreateStudioApiRoute,
  useCreateStudioGenerationRun,
  useCreateStudioPage,
  useCreateStudioProject,
  useCreateStudioPrompt,
  useDeleteStudioAgent,
  useDeleteStudioProject,
  usePatchStudioProject,
  useStudioAgent,
  useStudioAgents,
  useStudioApiRoutes,
  useStudioGenerationRuns,
  useStudioPages,
  useStudioProject,
  useStudioProjects,
  useStudioPrompts,
  useStudioWorkflows,
  useUpdateStudioProject,
} from './bundleStudio';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const wrapper = () => createTestWrapper();

const project = { id: 1, title: 'Bundle garagiste', status: 'DRAFT' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosClient.get).mockResolvedValue({ data: [] } as never);
  vi.mocked(axiosClient.post).mockResolvedValue({ data: project } as never);
  vi.mocked(axiosClient.put).mockResolvedValue({ data: project } as never);
  vi.mocked(axiosClient.patch).mockResolvedValue({ data: project } as never);
  vi.mocked(axiosClient.delete).mockResolvedValue({ data: null } as never);
});

describe('studioKeys', () => {
  it('compose les clés de listes et de détails', () => {
    expect(studioKeys.all).toEqual(['studio']);
    expect(studioKeys.projects()).toEqual(['studio', 'projects']);
    expect(studioKeys.projectDetail(7)).toEqual(['studio', 'projects', 'detail', 7]);
    expect(studioKeys.agentDetail(3)).toEqual(['studio', 'agents', 'detail', 3]);
    expect(studioKeys.promptDetail(4)).toEqual(['studio', 'prompts', 'detail', 4]);
    expect(studioKeys.pageDetail(5)).toEqual(['studio', 'pages', 'detail', 5]);
    expect(studioKeys.apiRouteDetail(6)).toEqual(['studio', 'api-routes', 'detail', 6]);
    expect(studioKeys.workflowDetail(8)).toEqual(['studio', 'workflows', 'detail', 8]);
    expect(studioKeys.runDetail(9)).toEqual(['studio', 'runs', 'detail', 9]);
  });

  it('inclut les filtres dans la clé de liste des projets', () => {
    expect(studioKeys.projectsList({ titleContains: 'garage', status: 'DRAFT' })).toEqual([
      'studio',
      'projects',
      'list',
      { titleContains: 'garage', status: 'DRAFT', tenantId: undefined, userId: undefined },
    ]);
  });
});

describe('useStudioProjects', () => {
  it('interroge la liste sans filtre', async () => {
    const { result } = renderHook(() => useStudioProjects(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/studio-projects', { params: {} });
  });

  it('traduit les filtres en critères JHipster', async () => {
    const { result } = renderHook(
      () =>
        useStudioProjects({
          titleContains: 'garage',
          status: 'READY',
          tenantId: 2,
          userId: 3,
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/studio-projects', {
      params: {
        'title.contains': 'garage',
        'status.equals': 'READY',
        'tenantId.equals': '2',
        'userId.equals': '3',
      },
    });
  });

  it('accepte un identifiant de tenant nul sans le filtrer', async () => {
    const { result } = renderHook(() => useStudioProjects({ tenantId: 0 }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/studio-projects', {
      params: { 'tenantId.equals': '0' },
    });
  });
});

describe('useStudioProject', () => {
  it('reste inactif sans identifiant', () => {
    const { result } = renderHook(() => useStudioProject(null), { wrapper: wrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('charge le détail du projet', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: project } as never);

    const { result } = renderHook(() => useStudioProject(1), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/studio-projects/1');
    expect(result.current.data).toEqual(project);
  });
});

describe('mutations projet', () => {
  const input = {
    title: 'Bundle garagiste',
    status: 'DRAFT' as const,
    tenant: { id: 1 },
    user: { id: 2 },
  };

  it('crée un projet', async () => {
    const { result } = renderHook(() => useCreateStudioProject(), { wrapper: wrapper() });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/studio-projects', input);
  });

  it("réinjecte l'identifiant dans le corps lors d'un remplacement", async () => {
    const { result } = renderHook(() => useUpdateStudioProject(), { wrapper: wrapper() });

    result.current.mutate({ id: 1, input });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.put).toHaveBeenCalledWith('/api/studio-projects/1', {
      ...input,
      id: 1,
    });
  });

  it('envoie un merge-patch avec le bon en-tête', async () => {
    const { result } = renderHook(() => usePatchStudioProject(), { wrapper: wrapper() });

    result.current.mutate({ id: 1, patch: { status: 'PUBLISHED' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.patch).toHaveBeenCalledWith(
      '/api/studio-projects/1',
      { id: 1, status: 'PUBLISHED' },
      { headers: { 'Content-Type': 'application/merge-patch+json' } },
    );
  });

  it('supprime un projet', async () => {
    const { result } = renderHook(() => useDeleteStudioProject(), { wrapper: wrapper() });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/studio-projects/1');
  });

  it("remonte l'échec de création", async () => {
    vi.mocked(axiosClient.post).mockRejectedValue(new Error('409'));
    const { result } = renderHook(() => useCreateStudioProject(), { wrapper: wrapper() });

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('ressources filles du bundle', () => {
  it.each([
    [
      'agents',
      () => useStudioAgents({ bundleId: 1, nameContains: 'rag', roleEquals: 'ANALYST' }),
      '/api/studio-agents',
      { 'bundleId.equals': '1', 'name.contains': 'rag', 'role.equals': 'ANALYST' },
    ],
    [
      'prompts',
      () => useStudioPrompts({ bundleId: 1, nameContains: 'x', categoryEquals: 'SYSTEM' }),
      '/api/studio-prompts',
      { 'bundleId.equals': '1', 'name.contains': 'x', 'category.equals': 'SYSTEM' },
    ],
    [
      'pages',
      () => useStudioPages({ bundleId: 1, slugContains: 'home', titleContains: 'Accueil' }),
      '/api/studio-pages',
      { 'bundleId.equals': '1', 'slug.contains': 'home', 'title.contains': 'Accueil' },
    ],
    [
      'routes API',
      () => useStudioApiRoutes({ bundleId: 1, methodEquals: 'GET', pathContains: '/x' }),
      '/api/studio-api-routes',
      { 'bundleId.equals': '1', 'method.equals': 'GET', 'path.contains': '/x' },
    ],
    [
      'workflows',
      () => useStudioWorkflows({ bundleId: 1, nameContains: 'n', slugContains: 's' }),
      '/api/studio-workflows',
      { 'bundleId.equals': '1', 'name.contains': 'n', 'slug.contains': 's' },
    ],
    [
      'exécutions',
      () => useStudioGenerationRuns({ projectId: 4, statusEquals: 'RUNNING' }),
      '/api/studio-generation-runs',
      { 'projectId.equals': '4', 'status.equals': 'RUNNING' },
    ],
  ])('liste les %s avec leurs filtres', async (_label, hook, url, params) => {
    const { result } = renderHook(hook, { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith(url, { params });
  });

  it('omet les filtres non renseignés', async () => {
    const { result } = renderHook(() => useStudioAgents({}), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/studio-agents', { params: {} });
  });

  it("reste inactif sans identifiant d'agent", () => {
    const { result } = renderHook(() => useStudioAgent(null), { wrapper: wrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it("charge le détail d'un agent", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { id: 3 } } as never);

    const { result } = renderHook(() => useStudioAgent(3), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/studio-agents/3');
  });

  it.each([
    ['un agent', () => useCreateStudioAgent(), '/api/studio-agents'],
    ['un prompt', () => useCreateStudioPrompt(), '/api/studio-prompts'],
    ['une page', () => useCreateStudioPage(), '/api/studio-pages'],
    ['une route API', () => useCreateStudioApiRoute(), '/api/studio-api-routes'],
    [
      'une exécution',
      () => useCreateStudioGenerationRun(),
      '/api/studio-generation-runs',
    ],
  ])('crée %s', async (_label, hook, url) => {
    const { result } = renderHook(hook, { wrapper: wrapper() });

    result.current.mutate({ name: 'x' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith(url, { name: 'x' });
  });

  it('supprime un agent', async () => {
    const { result } = renderHook(() => useDeleteStudioAgent(), { wrapper: wrapper() });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/studio-agents/3');
  });
});

describe('formatDateTime', () => {
  it('affiche un tiret sans date', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('formate une date ISO en français', () => {
    const formatted = formatDateTime('2026-07-01T09:05:00Z');

    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('retombe sur un tiret pour une date invalide', () => {
    expect(formatDateTime('pas une date')).toBe('—');
  });
});

describe('extractBackendError', () => {
  it('privilégie le message métier du backend', () => {
    expect(
      extractBackendError({ response: { data: { error: { message: 'SIREN inconnu' } } } }),
    ).toBe('SIREN inconnu');
  });

  it('retombe sur le statusText', () => {
    expect(extractBackendError({ response: { statusText: 'Not Found' } })).toBe('Not Found');
  });

  it('retombe sur un message générique', () => {
    expect(extractBackendError(new Error('boom'))).toBe(
      'Une erreur est survenue. Réessayez.',
    );
    expect(extractBackendError(null)).toBe('Une erreur est survenue. Réessayez.');
  });
});

describe('parseLobJson', () => {
  it('retourne null pour une valeur vide', () => {
    expect(parseLobJson(null)).toBeNull();
    expect(parseLobJson(undefined)).toBeNull();
    expect(parseLobJson('')).toBeNull();
  });

  it('analyse un JSON valide', () => {
    expect(parseLobJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('retourne null pour un JSON invalide', () => {
    expect(parseLobJson('{oops')).toBeNull();
  });
});

describe('STUDIO_PROJECT_STATUS_LABEL', () => {
  it('traduit tous les statuts', () => {
    expect(STUDIO_PROJECT_STATUS_LABEL.DRAFT).toBe('Brouillon');
    expect(STUDIO_PROJECT_STATUS_LABEL.READY).toBe('Prêt');
    expect(STUDIO_PROJECT_STATUS_LABEL.PUBLISHED).toBe('Publié');
    expect(STUDIO_PROJECT_STATUS_LABEL.ERROR).toBe('Erreur');
  });
});
