import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAxiosClient, createTestQueryClient, createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  prioritiesKeys,
  useCreatePriority,
  useDeletePriority,
  useUpdatePriorityStatus,
  useUserPriorities,
  type UserPriority,
} from './priorities';

vi.mock('./axiosClient', () => ({
  default: createMockAxiosClient(),
}));

const createWrapper = (queryClient?: ReturnType<typeof createTestQueryClient>) =>
  createTestWrapper(queryClient);

const mockPriority: UserPriority = {
  id: 1,
  kind: 'GOAL',
  label: 'Réduire les coûts',
  weight: 1,
  horizon: 'QUARTER',
  source: 'copilot',
  metadata: null,
  status: 'active',
  createdAt: '2026-07-20T09:00:00Z',
  updatedAt: '2026-07-20T09:00:00Z',
  tenant: { id: 1 },
  user: { id: 1 },
};

describe('prioritiesKeys', () => {
  it('builds stable query keys', () => {
    expect(prioritiesKeys.all).toEqual(['priorities']);
    expect(prioritiesKeys.list()).toEqual(['priorities', 'list', { status: undefined }]);
    expect(prioritiesKeys.list('active')).toEqual(['priorities', 'list', { status: 'active' }]);
  });
});

describe('useUserPriorities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches every priority when no status filter is given', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: [mockPriority] });

    const { result } = renderHook(() => useUserPriorities(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/user-priorities', { params: undefined });
    expect(result.current.data).toEqual([mockPriority]);
  });

  it('filters by status when provided', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: [mockPriority] });

    const { result } = renderHook(() => useUserPriorities('active'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/user-priorities', {
      params: { 'status.equals': 'active' },
    });
  });
});

describe('useCreatePriority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts to the copilot v2 endpoint and invalidates the priorities list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: { id: 1, label: 'Réduire les coûts', weight: 1, kind: 'GOAL', horizon: 'QUARTER', status: 'active' },
    });

    const { result } = renderHook(() => useCreatePriority(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ label: 'Réduire les coûts', kind: 'GOAL', horizon: 'QUARTER' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/copilot/v2/priorities', {
      label: 'Réduire les coûts',
      kind: 'GOAL',
      horizon: 'QUARTER',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: prioritiesKeys.all });
  });
});

describe('useUpdatePriorityStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes the status with a merge-patch+json content type and invalidates the list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(axiosClient.patch).mockResolvedValueOnce({ data: { ...mockPriority, status: 'achieved' } });

    const { result } = renderHook(() => useUpdatePriorityStatus(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ id: 1, status: 'achieved' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.patch).toHaveBeenCalledWith(
      '/api/user-priorities/1',
      { id: 1, status: 'achieved' },
      { headers: { 'Content-Type': 'application/merge-patch+json' } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: prioritiesKeys.all });
  });
});

describe('useDeletePriority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the priority by id and invalidates the list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(axiosClient.delete).mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useDeletePriority(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/user-priorities/1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: prioritiesKeys.all });
  });
});
