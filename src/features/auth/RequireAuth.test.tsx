import '@testing-library/jest-dom';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as renderWithTestProviders, mockUseNavigate, createMockAxiosClient } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import authReducer from './authSlice';
import RequireAuth from './RequireAuth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    ...mockUseNavigate(mockNavigate),
  };
});

vi.mock('@/api/axiosClient', () => ({
  default: createMockAxiosClient(),
}));

function renderWithProviders(preloadedAuth: {
  isAuthenticated: boolean;
  sessionChecked: boolean;
}) {
  return renderWithTestProviders(
    <RequireAuth>
      <div>protected content</div>
    </RequireAuth>,
    {
      reducers: { auth: authReducer },
      preloadedState: {
        auth: {
          username: null,
          email: null,
          roles: [],
          ...preloadedAuth,
        },
      },
    },
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

  it('redirects to onboarding if onboarding is not completed', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({
      data: { onboarding_completed: false },
    });
    renderWithProviders({ isAuthenticated: true, sessionChecked: true });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true }));
  });
});

