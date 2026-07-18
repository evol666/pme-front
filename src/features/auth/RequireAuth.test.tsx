import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '@/api/axiosClient';
import authReducer from './authSlice';
import RequireAuth from './RequireAuth';

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

function renderWithProviders(preloadedAuth: {
  isAuthenticated: boolean;
  sessionChecked: boolean;
}) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        username: null,
        email: null,
        roles: [],
        ...preloadedAuth,
      },
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <RequireAuth>
            <div>protected content</div>
          </RequireAuth>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('RequireAuth', () => {
  const originalLocation = globalThis.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: { onboarding_completed: true },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '', pathname: '/' },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('shows a loading state while the session has not been checked yet', () => {
    renderWithProviders({ isAuthenticated: false, sessionChecked: false });
    expect(screen.getByText(/vérification de la session/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('redirects to Keycloak when the session is checked but not authenticated', async () => {
    renderWithProviders({ isAuthenticated: false, sessionChecked: true });
    await waitFor(() => expect(globalThis.location.href).toBe('/oauth2/authorization/pme'));
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children once the user is authenticated and the session is checked', async () => {
    renderWithProviders({ isAuthenticated: true, sessionChecked: true });
    await waitFor(() => expect(screen.getByText('protected content')).toBeInTheDocument());
    expect(globalThis.location.href).toBe('');
  });
});
