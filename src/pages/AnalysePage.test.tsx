import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import AnalysePage from './AnalysePage';

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

function renderPage(entry: string) {
  return renderWithProviders(<AnalysePage />, { initialEntries: [entry] });
}

describe('AnalysePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a missing-job message when no jobId is present in the URL', () => {
    renderPage('/analyse');
    expect(screen.getByText('Job manquant')).toBeInTheDocument();
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('renders the in-progress state while the job is pending', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: {
        job_id: 'job-123',
        status: 'pending',
        current_step: null,
        progress: 10,
        error: null,
      },
    });

    renderPage('/analyse?jobId=job-123');

    expect(await screen.findByText('Analyse en cours')).toBeInTheDocument();
    expect(screen.getByText(/Job job-123/)).toBeInTheDocument();
    expect(await screen.findByText('Initialisation…')).toBeInTheDocument();
  });

  it('renders a known step label once the job reports a current_step', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: {
        job_id: 'job-123',
        status: 'enriching',
        current_step: 'enriching',
        progress: 40,
        error: null,
      },
    });

    renderPage('/analyse?jobId=job-123');

    expect(await screen.findByText('Enrichissement métier')).toBeInTheDocument();
  });

  it('renders the failed state with the backend error message', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: {
        job_id: 'job-123',
        status: 'failed',
        current_step: null,
        progress: 0,
        error: 'Le SIREN est invalide',
      },
    });

    renderPage('/analyse?jobId=job-123');

    expect(await screen.findByText('Analyse en échec')).toBeInTheDocument();
    expect(screen.getByText('Le SIREN est invalide')).toBeInTheDocument();
  });

  it('renders a generic error state when the status request fails', async () => {
    vi.mocked(axiosClient.get).mockRejectedValue({
      response: { data: { error: { message: 'Job introuvable' } } },
    });

    renderPage('/analyse?jobId=job-123');

    expect(await screen.findByText('Impossible de récupérer le statut du job.')).toBeInTheDocument();
    expect(await screen.findByText('Job introuvable')).toBeInTheDocument();
  });
});
