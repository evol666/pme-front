import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from './axiosClient';
import {
  entreprisesKeys,
  useEntreprise,
  useEntrepriseSearch,
  useRefreshEntreprise,
} from './entreprises';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('entreprisesKeys', () => {
  it('builds stable, distinguishable query keys', () => {
    expect(entreprisesKeys.all).toEqual(['entreprises']);
    expect(entreprisesKeys.search('acme', 0)).toEqual(['entreprises', 'search', 'acme', 0]);
    expect(entreprisesKeys.detail('123456789')).toEqual(['entreprises', 'detail', '123456789']);
  });
});

describe('useEntrepriseSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fire the query when the search term is shorter than 2 chars', () => {
    const { result } = renderHook(() => useEntrepriseSearch('a'), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('fetches search results once the term reaches 2 characters', async () => {
    const response = { total: 1, page: 0, size: 10, results: [] };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: response });

    const { result } = renderHook(() => useEntrepriseSearch('acme'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(axiosClient.get).toHaveBeenCalledWith('/api/entreprises/search', {
      params: { q: 'acme', page: 0, size: 10 },
    });
  });

  it('trims the query before sending it and before checking the length gate', () => {
    const { result } = renderHook(() => useEntrepriseSearch('  a  '), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });
});

describe('useEntreprise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when siren is missing', () => {
    const { result } = renderHook(() => useEntreprise(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('is disabled when siren does not match the 9-digit format', () => {
    const { result } = renderHook(() => useEntreprise('abc'), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('fetches the enriched company sheet for a valid 9-digit siren', async () => {
    const payload = { siren: '123456789' };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: payload });

    const { result } = renderHook(() => useEntreprise('123456789'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/entreprises/123456789');
    expect(result.current.data).toEqual(payload);
  });
});

describe('useRefreshEntreprise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts a refresh request and updates the query cache on success', async () => {
    const payload = { siren: '123456789', enriched_at: 'now' };
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: payload });

    const { result } = renderHook(() => useRefreshEntreprise(), { wrapper: createWrapper() });

    result.current.mutate('123456789');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/entreprises/123456789/refresh');
    expect(result.current.data).toEqual(payload);
  });
});
