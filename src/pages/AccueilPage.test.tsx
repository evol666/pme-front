import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import authReducer from '@/features/auth/authSlice';
import AccueilPage from './AccueilPage';

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

function renderPage() {
  return renderWithProviders(<AccueilPage />, {
    reducers: { auth: authReducer },
    preloadedState: {
      auth: {
        username: 'Alice',
        email: 'alice@example.com',
        roles: [],
        isAuthenticated: true,
        sessionChecked: true,
      },
    },
  });
}

function mockGetByUrl(handlers: Record<string, unknown>) {
  vi.mocked(axiosClient.get).mockImplementation((url: string) => {
    for (const key of Object.keys(handlers)) {
      if (url.startsWith(key)) {
        return Promise.resolve({ data: handlers[key] });
      }
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

describe('AccueilPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty states when there is no data yet', async () => {
    mockGetByUrl({
      '/api/company/analyze': [],
      '/api/ai-recommendations': [],
      '/api/rag-documents': [],
    });

    renderPage();

    expect(await screen.findByText('Bonjour, Alice')).toBeInTheDocument();
    expect(screen.getByText(/Aucune analyse\./)).toBeInTheDocument();
    expect(screen.getByText('Aucune recommandation pour le moment.')).toBeInTheDocument();
  });

  it('renders recent analyses and recommendations with their status', async () => {
    mockGetByUrl({
      '/api/company/analyze': [
        {
          job_id: 'job-1',
          siren: '123456789',
          company_name: 'Boulangerie Dupont',
          status: 'completed',
          score: 82.4,
          detected_business_label: 'Boulangerie',
        },
      ],
      '/api/ai-recommendations': [
        { id: 1, job_id: 'job-1', title: 'Améliorer le SEO local', action: 'seo', status: 'new' },
      ],
      '/api/rag-documents': [
        { id: 1, status: 'INDEXING' },
        { id: 2, status: 'DONE' },
      ],
    });

    renderPage();

    expect(await screen.findByText('Boulangerie Dupont')).toBeInTheDocument();
    expect(screen.getByText(/SIREN 123456789 · Boulangerie/)).toBeInTheDocument();
    expect(screen.getByText('Terminée')).toBeInTheDocument();
    expect(screen.getByText('Améliorer le SEO local')).toBeInTheDocument();
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    expect(screen.getByText("1 en cours d'indexation")).toBeInTheDocument();
  });

  it('falls back to a generic greeting when no username is known', async () => {
    mockGetByUrl({
      '/api/company/analyze': [],
      '/api/ai-recommendations': [],
      '/api/rag-documents': [],
    });

    renderWithProviders(<AccueilPage />, {
      reducers: { auth: authReducer },
      preloadedState: {
        auth: {
          username: null,
          email: null,
          roles: [],
          isAuthenticated: true,
          sessionChecked: true,
        },
      },
    });

    expect(await screen.findByText('Bonjour, Bienvenue')).toBeInTheDocument();
  });
});
