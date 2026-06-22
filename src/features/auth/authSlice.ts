import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthState {
  username: string | null;
  email: string | null;
  roles: string[];
  isAuthenticated: boolean;
  sessionChecked: boolean;
}

const initialState: AuthState = {
  username: null,
  email: null,
  roles: [],
  isAuthenticated: false,
  sessionChecked: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<{ login: string; email?: string; authorities: string[] }>) {
      const user = action.payload;
      state.username = user.login;
      state.email = user.email ?? null;
      state.roles = user.authorities;
      state.isAuthenticated = true;
    },
    setAuthReady(state) {
      state.sessionChecked = true;
    },
    logout(state) {
      state.username = null;
      state.email = null;
      state.roles = [];
      state.isAuthenticated = false;
    },
  },
});

export const { setUser, setAuthReady, logout } = authSlice.actions;
export default authSlice.reducer;
