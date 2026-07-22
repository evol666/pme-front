import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAxiosClient, createTestQueryClient, createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  parsePersonaJsonObject,
  personasKeys,
  useCreatePersona,
  useDeletePersona,
  usePersonas,
  type UserPersona,
} from './personas';

vi.mock('./axiosClient', () => ({
  default: createMockAxiosClient(),
}));

const createWrapper = (queryClient?: ReturnType<typeof createTestQueryClient>) =>
  createTestWrapper(queryClient);

const mockPersona: UserPersona = {
  id: 1,
  role: 'CFO',
  goals: '{"reduceCosts":true}',
  preferences: null,
  createdAt: '2026-07-20T09:00:00Z',
  updatedAt: '2026-07-20T09:00:00Z',
  tenant: { id: 1 },
  user: { id: 1 },
};

describe('personasKeys', () => {
  it('builds stable query keys', () => {
    expect(personasKeys.all).toEqual(['personas']);
    expect(personasKeys.list()).toEqual(['personas', 'list', { role: undefined }]);
    expect(personasKeys.list('CFO')).toEqual(['personas', 'list', { role: 'CFO' }]);
  });
});

describe('usePersonas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the persona list without a role filter', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: [mockPersona] });

    const { result } = renderHook(() => usePersonas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/user-personas', { params: {} });
    expect(result.current.data).toEqual([mockPersona]);
  });

  it('filters by role when provided', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: [mockPersona] });

    const { result } = renderHook(() => usePersonas('CFO'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/user-personas', {
      params: { 'role.contains': 'CFO' },
    });
  });
});

describe('useCreatePersona', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts the new persona and invalidates the personas list on success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: mockPersona });

    const { result } = renderHook(() => useCreatePersona(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ role: 'CFO' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/user-personas', { role: 'CFO' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: personasKeys.all });
  });
});

describe('useDeletePersona', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the persona by id and invalidates the personas list on success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(axiosClient.delete).mockResolvedValueOnce({ data: undefined });

    const { result } = renderHook(() => useDeletePersona(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.delete).toHaveBeenCalledWith('/api/user-personas/1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: personasKeys.all });
  });
});

describe('parsePersonaJsonObject', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(parsePersonaJsonObject(null)).toBeNull();
    expect(parsePersonaJsonObject(undefined)).toBeNull();
    expect(parsePersonaJsonObject('')).toBeNull();
  });

  it('parses a valid JSON object string', () => {
    expect(parsePersonaJsonObject('{"reduceCosts":true}')).toEqual({ reduceCosts: true });
  });

  it('returns null for malformed JSON', () => {
    expect(parsePersonaJsonObject('{not json')).toBeNull();
  });

  it('returns null when the parsed value is an array', () => {
    expect(parsePersonaJsonObject('[1,2,3]')).toBeNull();
  });

  it('returns null when the parsed value is a primitive', () => {
    expect(parsePersonaJsonObject('"just a string"')).toBeNull();
    expect(parsePersonaJsonObject('42')).toBeNull();
  });
});
