import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from './axiosClient';
import { store } from '../store';
import { fetchAuthInfo, logout } from './auth';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('auth API', () => {
  const originalLocation = globalThis.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state by dispatching logout manually
    store.dispatch({ type: 'auth/logout' });
    // Reset location mock
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  describe('fetchAuthInfo', () => {
    it('should dispatch setUser and setAuthReady on successful API response', async () => {
      const mockUser = { login: 'john_doe', email: 'john@example.com', authorities: ['ROLE_USER'] };
      vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: mockUser });

      await fetchAuthInfo();

      const state = store.getState().auth;
      expect(axiosClient.get).toHaveBeenCalledWith('/api/account');
      expect(state.username).toBe('john_doe');
      expect(state.email).toBe('john@example.com');
      expect(state.roles).toEqual(['ROLE_USER']);
      expect(state.isAuthenticated).toBe(true);
      expect(state.sessionChecked).toBe(true);
    });

    it('should only dispatch setAuthReady on API failure', async () => {
      vi.mocked(axiosClient.get).mockRejectedValueOnce(new Error('Network error'));

      await fetchAuthInfo();

      const state = store.getState().auth;
      expect(axiosClient.get).toHaveBeenCalledWith('/api/account');
      expect(state.username).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.sessionChecked).toBe(true);
    });

    it('should not dispatch setUser if API response does not contain login', async () => {
      vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: null });

      await fetchAuthInfo();

      const state = store.getState().auth;
      expect(state.username).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.sessionChecked).toBe(true);
    });
  });

  describe('logout', () => {
    it('should dispatch logout action and redirect to /api/logout', () => {
      // First populate the user
      store.dispatch({
        type: 'auth/setUser',
        payload: { login: 'test', email: 'test@test.com', authorities: [] },
      });

      expect(store.getState().auth.isAuthenticated).toBe(true);

      logout();

      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.username).toBeNull();
      expect(globalThis.location.href).toBe('/api/logout');
    });
  });
});
