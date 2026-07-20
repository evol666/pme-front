import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper, createTestQueryClient } from '@athanor/test-utils';
import axiosClient from './axiosClient';

import {
  analysesKeys,
  useAnalyses,
  useAnalysisStatus,
  useLaunchAnalysis,
} from './analyses';

const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (options: any) => {
      mockUseQuery(options);
      return actual.useQuery(options);
    },
  };
});

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const createWrapper = (queryClient?: any) => createTestWrapper(queryClient);


describe('analysesKeys', () => {
  it('defines correct query keys', () => {
    expect(analysesKeys.all).toEqual(['analyses']);
    expect(analysesKeys.list('123456789', 10)).toEqual(['analyses', 'list', { siren: '123456789', limit: 10 }]);
    expect(analysesKeys.status('job-123')).toEqual(['analyses', 'status', 'job-123']);
  });
});

describe('useAnalyses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches analyses list with siren and limit parameters', async () => {
    const mockList = [{ job_id: 'job-123', siren: '123456789', status: 'completed' }];
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockList });

    const { result } = renderHook(() => useAnalyses('123456789', 10), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/company/analyze', {
      params: { siren: '123456789', limit: 10 },
    });
    expect(result.current.data).toEqual(mockList);
  });
});

describe('useAnalysisStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when jobId is not provided', () => {
    const { result } = renderHook(() => useAnalysisStatus(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('fetches status for a valid jobId', async () => {
    const mockPayload = {
      job_id: 'job-123',
      status: 'completed',
      current_step: null,
      progress: null,
      started_at: null,
      completed_at: null,
      error: null,
      company: null,
      detected_business: null,
      recommended_tools: null,
      workflows: null,
      proposal: null,
      diagnostic: null,
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockPayload });

    const { result } = renderHook(() => useAnalysisStatus('job-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/company/analyze/job-123');
    expect(result.current.data).toEqual(mockPayload);
  });

  it('defines correct refetchInterval logic based on status', () => {
    mockUseQuery.mockClear();
    renderHook(() => useAnalysisStatus('job-123'), { wrapper: createWrapper() });

    expect(mockUseQuery).toHaveBeenCalled();
    const options = mockUseQuery.mock.calls[0][0] as any;
    expect(options.refetchInterval).toBeTypeOf('function');

    const refetchInterval = options.refetchInterval;
    // Check when running (not completed, failed, or error)
    expect(refetchInterval({ state: { data: { status: 'running' } } })).toBe(3000);
    expect(refetchInterval({ state: { data: { status: 'pending' } } })).toBe(3000);
    // Check when finished/terminal
    expect(refetchInterval({ state: { data: { status: 'completed' } } })).toBe(false);
    expect(refetchInterval({ state: { data: { status: 'failed' } } })).toBe(false);
    expect(refetchInterval({ state: { data: { status: 'error' } } })).toBe(false);
    // Check when no status or data
    expect(refetchInterval({ state: {} })).toBe(false);
    expect(refetchInterval({ state: { data: null } })).toBe(false);
  });
});


describe('useLaunchAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('launches analysis and invalidates analyses query key on success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: { job_id: 'job-123', status: 'queued' },
    });

    const { result } = renderHook(() => useLaunchAnalysis(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ siren: '123456789', metier_force: 'garagiste' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/company/analyze', {
      siren: '123456789',
      metier_force: 'garagiste',
    });
    expect(result.current.data).toEqual({ job_id: 'job-123', status: 'queued' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: analysesKeys.all });
  });
});
