import { describe, expect, it } from 'vitest';
import authReducer, { logout, setAuthReady, setUser, type AuthState } from './authSlice';

const initialState: AuthState = {
  username: null,
  email: null,
  roles: [],
  isAuthenticated: false,
  sessionChecked: false,
};

describe('authSlice', () => {
  it('returns the initial state', () => {
    expect(authReducer(undefined, { type: '@@INIT' })).toEqual(initialState);
  });

  it('setUser populates username, email, roles and marks authenticated', () => {
    const state = authReducer(
      initialState,
      setUser({ login: 'jdoe', email: 'jdoe@example.com', authorities: ['ROLE_USER'] }),
    );
    expect(state).toEqual({
      username: 'jdoe',
      email: 'jdoe@example.com',
      roles: ['ROLE_USER'],
      isAuthenticated: true,
      sessionChecked: false,
    });
  });

  it('setUser defaults email to null when not provided', () => {
    const state = authReducer(initialState, setUser({ login: 'jdoe', authorities: [] }));
    expect(state.email).toBeNull();
    expect(state.isAuthenticated).toBe(true);
  });

  it('setAuthReady flips sessionChecked without touching other fields', () => {
    const state = authReducer(initialState, setAuthReady());
    expect(state.sessionChecked).toBe(true);
    expect(state.isAuthenticated).toBe(false);
  });

  it('logout clears user info but preserves sessionChecked', () => {
    const authenticated: AuthState = {
      username: 'jdoe',
      email: 'jdoe@example.com',
      roles: ['ROLE_USER'],
      isAuthenticated: true,
      sessionChecked: true,
    };
    const state = authReducer(authenticated, logout());
    expect(state).toEqual({
      username: null,
      email: null,
      roles: [],
      isAuthenticated: false,
      sessionChecked: true,
    });
  });
});
