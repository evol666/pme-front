import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import WorkflowExecutionPage from './WorkflowExecutionPage';

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderPage(entry: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/workflows/runs/:id" element={<WorkflowExecutionPage />} />
    </Routes>,
    { initialEntries: [entry] },
  );
}

const run = {
  id: 42,
  workflowId: 'onboarding-nouvelle-entreprise',
  trigger: 'manual',
  status: 'RUNNING' as const,
  createdAt: '2026-07-01T10:00:00Z',
  startedAt: '2026-07-01T10:00:05Z',
  finishedAt: null,
  durationMs: 1500,
  retries: 0,
  error: null,
  outputs: null,
};

const step = {
  id: 1,
  runId: 42,
  stepId: 'fetch-data',
  label: 'Récupération des données',
  status: 'succeeded' as const,
  startedAt: '2026-07-01T10:00:05Z',
  finishedAt: '2026-07-01T10:00:06Z',
  durationMs: 800,
  error: null,
  outputs: '{"count":3}',
};

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

describe('WorkflowExecutionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an invalid-id message when the run id is not numeric', () => {
    renderPage('/workflows/runs/not-a-number');
    expect(screen.getByText('Identifiant de run invalide.')).toBeInTheDocument();
  });

  it('shows a loading state while the run is being fetched', () => {
    vi.mocked(axiosClient.get).mockReturnValue(new Promise(() => {}));
    renderPage('/workflows/runs/42');
    expect(screen.getByText('Chargement du run…')).toBeInTheDocument();
  });

  it('shows an error state when the run request fails', async () => {
    vi.mocked(axiosClient.get).mockRejectedValue({
      response: { data: { error: { message: 'Run inexistant' } } },
    });
    renderPage('/workflows/runs/42');
    expect(await screen.findByText('Run inexistant')).toBeInTheDocument();
  });

  it('renders run metrics, steps timeline and allows canceling a running run', async () => {
    mockGetByUrl({
      '/api/workflow-runs/42': run,
      '/api/workflow-steps': [step],
    });
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { ...run, status: 'CANCELED' } });

    renderPage('/workflows/runs/42');

    expect(await screen.findByText('onboarding-nouvelle-entreprise')).toBeInTheDocument();
    expect(screen.getByText('Récupération des données')).toBeInTheDocument();
    expect(screen.getByText('Outputs (1 clés)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Annuler l'exécution" }));

    await waitFor(() =>
      expect(axiosClient.post).toHaveBeenCalledWith('/api/workflow-runs/42/cancel'),
    );
  });

  it('shows the empty steps message when there are no steps yet', async () => {
    mockGetByUrl({
      '/api/workflow-runs/42': { ...run, status: 'PENDING' },
      '/api/workflow-steps': [],
    });

    renderPage('/workflows/runs/42');

    expect(await screen.findByText('Aucune étape exécutée pour ce run.')).toBeInTheDocument();
  });

  it('surfaces the run error banner when the run has failed', async () => {
    mockGetByUrl({
      '/api/workflow-runs/42': { ...run, status: 'FAILED', error: 'Timeout API externe' },
      '/api/workflow-steps': [],
    });

    renderPage('/workflows/runs/42');

    expect(await screen.findByText(/Timeout API externe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Relancer (Retry)' })).toBeInTheDocument();
  });
});
