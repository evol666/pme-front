import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import { metiersKeys, useMetierModules } from './metiers';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const createWrapper = () => createTestWrapper();


describe('metiersKeys', () => {
  it('defines correct query keys', () => {
    expect(metiersKeys.all).toEqual(['metiers']);
    expect(metiersKeys.modules('garagiste')).toEqual(['metiers', 'modules', 'garagiste']);
  });
});

describe('useMetierModules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when metierId is null, undefined, or empty', () => {
    const { result: resNull } = renderHook(() => useMetierModules(null), { wrapper: createWrapper() });
    expect(resNull.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();

    const { result: resUndef } = renderHook(() => useMetierModules(undefined), { wrapper: createWrapper() });
    expect(resUndef.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('fetches modules and tools for a valid metierId', async () => {
    const mockPayload = {
      metier_id: 'garagiste',
      label: 'Garagiste',
      modules: [],
      tools: [],
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockPayload });

    const { result } = renderHook(() => useMetierModules('garagiste'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/pme/metiers/garagiste/modules');
    expect(result.current.data).toEqual(mockPayload);
  });

  it('escapes special characters in the metierId in the request URL', async () => {
    const mockPayload = {
      metier_id: 'boulanger/patissier',
      label: 'Boulanger Pâtissier',
      modules: [],
      tools: [],
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockPayload });

    const { result } = renderHook(() => useMetierModules('boulanger/patissier'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith(`/api/pme/metiers/${encodeURIComponent('boulanger/patissier')}/modules`);
  });
});
