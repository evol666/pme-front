import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAxiosClient, createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import { modulesKeys, useDetectMetier, useExecuteModule, type PmeMetierDTO } from './modules';

vi.mock('./axiosClient', () => ({
  default: createMockAxiosClient(),
}));

const mockMetier: PmeMetierDTO = {
  id: 'restauration',
  nom_metier: 'Restauration',
  code_naf: ['56.10A'],
  secteur: 'Hôtellerie-restauration',
  description: null,
  mots_cles: null,
  prompt_associe: null,
  prompts_dossier: null,
  icone: null,
  type_entite: null,
  effectif_typique: null,
  indices_classification: null,
};

describe('modulesKeys', () => {
  it('builds stable query keys', () => {
    expect(modulesKeys.all).toEqual(['modules']);
    expect(modulesKeys.detect('56.10A')).toEqual(['modules', 'detect', '56.10A']);
  });
});

describe('useDetectMetier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the metier from a NAF code', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockMetier });

    const { result } = renderHook(() => useDetectMetier('56.10A'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/pme/metiers/naf/56.10A');
    expect(result.current.data).toEqual(mockMetier);
  });

  it('URL-encodes the NAF code', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockMetier });

    renderHook(() => useDetectMetier('56.10A/B'), { wrapper: createTestWrapper() });

    await waitFor(() =>
      expect(axiosClient.get).toHaveBeenCalledWith('/api/pme/metiers/naf/56.10A%2FB'),
    );
  });

  it('returns null (fallback générique) when the backend responds 404', async () => {
    vi.mocked(axiosClient.get).mockRejectedValueOnce({ response: { status: 404 } });

    const { result } = renderHook(() => useDetectMetier('99.99Z'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('rethrows non-404 errors', async () => {
    vi.mocked(axiosClient.get).mockRejectedValueOnce({ response: { status: 500 } });

    const { result } = renderHook(() => useDetectMetier('56.10A'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fetch when codeNaf is null/undefined', () => {
    const { result } = renderHook(() => useDetectMetier(undefined), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });
});

describe('useExecuteModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const request = {
    metier_id: 'restauration',
    prompt_id: 'diagnostic',
    contexte_entreprise: 'Restaurant de 12 couverts',
  };

  it('extracts markdown from the "markdown" key when present', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: { markdown: '# Diagnostic', meta: { model: 'gpt' } },
    });

    const { result } = renderHook(() => useExecuteModule(), { wrapper: createTestWrapper() });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/pme/execute', request);
    expect(result.current.data).toEqual({ markdown: '# Diagnostic', meta: { model: 'gpt' } });
  });

  it('falls back to the "content" key when "markdown" is absent', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: { content: '# Contenu' } });

    const { result } = renderHook(() => useExecuteModule(), { wrapper: createTestWrapper() });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.markdown).toBe('# Contenu');
  });

  it('falls back to the "text" key when "markdown"/"content" are absent', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: { text: 'texte brut' } });

    const { result } = renderHook(() => useExecuteModule(), { wrapper: createTestWrapper() });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.markdown).toBe('texte brut');
  });

  it('returns an empty markdown string when no known key is present', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: { unrelated: true } });

    const { result } = renderHook(() => useExecuteModule(), { wrapper: createTestWrapper() });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.markdown).toBe('');
    expect(result.current.data?.meta).toBeNull();
  });

  it('ignores meta when it is not a plain object (e.g. an array)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: { markdown: 'ok', meta: [1, 2, 3] },
    });

    const { result } = renderHook(() => useExecuteModule(), { wrapper: createTestWrapper() });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.meta).toBeNull();
  });
});
