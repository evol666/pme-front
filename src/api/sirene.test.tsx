import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper, createTestQueryClient } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  sireneKeys,
  useSireneImportStatus,
  useSireneStats,
  useStartSireneImport,
} from './sirene';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const createWrapper = (queryClient?: any) => createTestWrapper(queryClient);


describe('sireneKeys', () => {
  it('defines the correct query keys', () => {
    expect(sireneKeys.status).toEqual(['sirene', 'status']);
    expect(sireneKeys.stats).toEqual(['sirene', 'stats']);
  });
});

describe('useSireneImportStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches import status when enabled', async () => {
    const mockStatus = {
      running: true,
      phase: 'downloading',
      processed: 100,
      upserted: 80,
      skipped: 20,
      error: null,
      startedAt: '2026-07-20T09:00:00Z',
      finishedAt: null,
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockStatus });

    const { result } = renderHook(() => useSireneImportStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/sirene/import/status');
    expect(result.current.data).toEqual(mockStatus);
  });

  it('does not fetch import status when disabled', () => {
    const { result } = renderHook(() => useSireneImportStatus(false), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });
});

describe('useSireneStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches sirene stats', async () => {
    const mockStats = { actives: 1000, cessees: 200, total: 1200 };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockStats });

    const { result } = renderHook(() => useSireneStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/sirene/stats');
    expect(result.current.data).toEqual(mockStats);
  });
});

describe('useStartSireneImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts sirene import and invalidates status query on success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: { message: 'Import started' } });

    const { result } = renderHook(() => useStartSireneImport(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/sirene/import');
    expect(result.current.data).toEqual({ message: 'Import started' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sireneKeys.status });
  });
});
