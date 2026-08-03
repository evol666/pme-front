import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  parseAdminJsonObject,
  useAiAlerts,
  useAiUsages,
  useAnalyticsEvents,
  useDeleteTenant,
  useDeleteTenantMemory,
  useKpiSnapshots,
  usePatchAiAlert,
  usePatchTenant,
  usePatchTenantPlan,
  usePmeHealth,
  useTenantBrandings,
  useTenantMemories,
  useTenantPlans,
  useTenantProfiles,
  useTenants,
  useTenantSettings,
} from './admin';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const wrapper = () => createTestWrapper();

/** En-tête exigé par les endpoints partialUpdate JHipster. */
const MERGE_PATCH = { headers: { 'Content-Type': 'application/merge-patch+json' } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosClient.get).mockResolvedValue({ data: [] } as never);
  vi.mocked(axiosClient.patch).mockResolvedValue({ data: { id: 1 } } as never);
  vi.mocked(axiosClient.delete).mockResolvedValue({ data: null } as never);
});

describe('usePmeHealth', () => {
  it("interroge l'état de santé du backend", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: { backend_status: 'UP', ollama_status: 'UP', local_ai_ready: true },
    } as never);

    const { result } = renderHook(() => usePmeHealth(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/health');
    expect(result.current.data).toMatchObject({ local_ai_ready: true });
  });
});

describe('listes paginées', () => {
  it('demande les alertes triées par date décroissante', async () => {
    const { result } = renderHook(() => useAiAlerts(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/ai-alerts', {
      params: { page: '0', size: '200', sort: 'createdAt,desc' },
    });
  });

  it('filtre les alertes par sévérité et statut', async () => {
    const { result } = renderHook(() => useAiAlerts('HIGH' as never, 'OPEN'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/ai-alerts', {
      params: expect.objectContaining({
        'severity.equals': 'HIGH',
        'status.equals': 'OPEN',
      }),
    });
  });

  it('filtre les consommations IA', async () => {
    const { result } = renderHook(() => useAiUsages('ollama', 'OK'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/ai-usages', {
      params: expect.objectContaining({
        'provider.equals': 'ollama',
        'status.equals': 'OK',
      }),
    });
  });

  it("filtre les évènements d'analytics", async () => {
    const { result } = renderHook(() => useAnalyticsEvents('page_', 'nav'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/analytics-events', {
      params: expect.objectContaining({
        'eventName.contains': 'page_',
        'category.equals': 'nav',
      }),
    });
  });
});

describe('KPI', () => {
  it('liste les instantanés sans filtre', async () => {
    const { result } = renderHook(() => useKpiSnapshots(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/kpi-snapshots', { params: {} });
  });

  it('filtre par KPI et granularité', async () => {
    const { result } = renderHook(() => useKpiSnapshots('ca', 'MONTH'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/kpi-snapshots', {
      params: { 'kpi.equals': 'ca', 'granularity.equals': 'MONTH' },
    });
  });
});

describe('tenants', () => {
  it('liste les tenants sans filtre', async () => {
    const { result } = renderHook(() => useTenants(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/tenants', { params: {} });
  });

  it('filtre par slug et nom', async () => {
    const { result } = renderHook(() => useTenants('acme', 'Acm'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/tenants', {
      params: { 'slug.equals': 'acme', 'name.contains': 'Acm' },
    });
  });

  it('applique un merge-patch sur un tenant', async () => {
    const { result } = renderHook(() => usePatchTenant(), { wrapper: wrapper() });

    result.current.mutate({ id: 1, name: 'Acme' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.patch).toHaveBeenCalledWith(
      '/api/tenants/1',
      { name: 'Acme' },
      MERGE_PATCH,
    );
  });

  it('supprime un tenant', async () => {
    const { result } = renderHook(() => useDeleteTenant(), { wrapper: wrapper() });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/tenants/1');
  });
});

describe('ressources rattachées à un tenant', () => {
  it.each([
    ['réglages', (id?: number) => useTenantSettings(id), '/api/tenant-settings'],
    ['profils', (id?: number) => useTenantProfiles(id), '/api/tenant-profiles'],
    ['plans', (id?: number) => useTenantPlans(id), '/api/tenant-plans'],
    ['identités visuelles', (id?: number) => useTenantBrandings(id), '/api/tenant-brandings'],
  ])('liste les %s de tous les tenants', async (_label, hook, url) => {
    const { result } = renderHook(() => hook(undefined), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith(url, { params: {} });
  });

  it.each([
    ['réglages', (id?: number) => useTenantSettings(id), '/api/tenant-settings'],
    ['profils', (id?: number) => useTenantProfiles(id), '/api/tenant-profiles'],
    ['plans', (id?: number) => useTenantPlans(id), '/api/tenant-plans'],
    ['identités visuelles', (id?: number) => useTenantBrandings(id), '/api/tenant-brandings'],
  ])('restreint les %s à un tenant', async (_label, hook, url) => {
    const { result } = renderHook(() => hook(7), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith(url, {
      params: { 'tenantId.equals': '7' },
    });
  });

  it('applique un merge-patch sur un plan', async () => {
    const { result } = renderHook(() => usePatchTenantPlan(), { wrapper: wrapper() });

    result.current.mutate({ id: 2, quotaTokens: 1000 } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.patch).toHaveBeenCalledWith(
      '/api/tenant-plans/2',
      { quotaTokens: 1000 },
      MERGE_PATCH,
    );
  });
});

describe('mémoires du tenant', () => {
  it('liste sans filtre', async () => {
    const { result } = renderHook(() => useTenantMemories(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/tenant-memories', { params: {} });
  });

  it('filtre par catégorie et tenant', async () => {
    const { result } = renderHook(() => useTenantMemories('preference', 7), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/tenant-memories', {
      params: { 'category.equals': 'preference', 'tenantId.equals': '7' },
    });
  });

  it('supprime une mémoire', async () => {
    const { result } = renderHook(() => useDeleteTenantMemory(), { wrapper: wrapper() });

    result.current.mutate(5);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/tenant-memories/5');
  });
});

describe('usePatchAiAlert', () => {
  it("retire l'identifiant du corps et l'envoie dans l'URL", async () => {
    const { result } = renderHook(() => usePatchAiAlert(), { wrapper: wrapper() });

    result.current.mutate({ id: 9, status: 'DISMISSED' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.patch).toHaveBeenCalledWith(
      '/api/ai-alerts/9',
      { status: 'DISMISSED' },
      MERGE_PATCH,
    );
  });

  it("remonte l'échec du backend", async () => {
    vi.mocked(axiosClient.patch).mockRejectedValue(new Error('409'));
    const { result } = renderHook(() => usePatchAiAlert(), { wrapper: wrapper() });

    result.current.mutate({ id: 9 } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('parseAdminJsonObject', () => {
  it('retourne null pour une valeur vide', () => {
    expect(parseAdminJsonObject(null)).toBeNull();
    expect(parseAdminJsonObject(undefined)).toBeNull();
    expect(parseAdminJsonObject('')).toBeNull();
  });

  it('analyse un objet JSON', () => {
    expect(parseAdminJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('rejette les tableaux et les primitives', () => {
    expect(parseAdminJsonObject('[1,2]')).toBeNull();
    expect(parseAdminJsonObject('42')).toBeNull();
    expect(parseAdminJsonObject('"texte"')).toBeNull();
    expect(parseAdminJsonObject('null')).toBeNull();
  });

  it('retourne null pour un JSON invalide', () => {
    expect(parseAdminJsonObject('{oops')).toBeNull();
  });
});
