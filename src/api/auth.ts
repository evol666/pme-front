import axiosClient from './axiosClient';
import { store } from '../store';
import { setUser, setAuthReady, logout as logoutAction } from '../features/auth/authSlice';

export async function fetchAuthInfo(): Promise<void> {
  try {
    const { data } = await axiosClient.get<{ login: string; email?: string; authorities: string[] }>('/api/account');
    if (data?.login) {
      store.dispatch(setUser(data));
    }
  } catch {
    // Non authentifié, RequireAuth se chargera de la redirection
  } finally {
    store.dispatch(setAuthReady());
  }
}

export function logout(): void {
  store.dispatch(logoutAction());
  window.location.href = '/api/logout';
}
