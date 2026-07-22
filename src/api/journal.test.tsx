import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAxiosClient, createTestQueryClient, createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import { journalKeys, useDeleteJournalEvent, useJournalEvents, type JournalEvent } from './journal';

vi.mock('./axiosClient', () => ({
  default: createMockAxiosClient(),
}));

const createWrapper = (queryClient?: ReturnType<typeof createTestQueryClient>) =>
  createTestWrapper(queryClient);

const mockEvent: JournalEvent = {
  id: 1,
  kind: 'note',
  title: 'Appel client',
  content: null,
  occurredAt: '2026-07-20T09:00:00Z',
  createdAt: '2026-07-20T09:00:00Z',
  siren: '123456789',
  tenant: { id: 1 },
  user: { id: 1 },
};

describe('journalKeys', () => {
  it('builds a stable list key from the given params', () => {
    expect(journalKeys.all).toEqual(['journal']);
    expect(journalKeys.list({ page: 0, size: 25, sort: 'occurredAt,desc' })).toEqual([
      'journal',
      'list',
      { page: 0, size: 25, sort: 'occurredAt,desc' },
    ]);
  });
});

describe('useJournalEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies default pagination/sort and reads the total from the x-total-count header', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: [mockEvent],
      headers: { 'x-total-count': '42' },
    });

    const { result } = renderHook(() => useJournalEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/journal-events', {
      params: { page: 0, size: 25, sort: 'occurredAt,desc' },
    });
    expect(result.current.data).toEqual({ items: [mockEvent], total: 42 });
  });

  it('adds kind/siren criteria when provided', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: [], headers: {} });

    const { result } = renderHook(
      () => useJournalEvents({ kind: 'note', siren: '123456789' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/journal-events', {
      params: {
        page: 0,
        size: 25,
        sort: 'occurredAt,desc',
        'kind.equals': 'note',
        'siren.equals': '123456789',
      },
    });
  });

  it('defaults total to 0 when the x-total-count header is missing', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: [], headers: {} });

    const { result } = renderHook(() => useJournalEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(0);
  });
});

describe('useDeleteJournalEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the event by id and invalidates the journal list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(axiosClient.delete).mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useDeleteJournalEvent(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/journal-events/1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: journalKeys.all });
  });
});
