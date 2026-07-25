import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import AnalysesPage from './AnalysesPage';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  const { mockUseNavigate } = await import('@athanor/test-utils/mocks/router');
  return {
    ...actual,
    ...mockUseNavigate(mockNavigate),
  };
});

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function renderPage() {
  return renderWithProviders(<AnalysesPage />);
}

describe('AnalysesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when there is no analysis yet', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] });

    renderPage();

    expect(
      await screen.findByText('Aucune analyse pour le moment. Lancez-en une ci-dessus.'),
    ).toBeInTheDocument();
  });

  it('renders the history and navigates to the job on click', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: [
        {
          job_id: 'job-1',
          siren: '123456789',
          company_name: 'Boulangerie Dupont',
          status: 'completed',
          score: 75,
          detected_business_label: 'Boulangerie',
          current_step: null,
          created_at: '2026-07-01T00:00:00Z',
        },
      ],
    });

    renderPage();

    const item = await screen.findByRole('button', {
      name: 'Ouvrir l’analyse Boulangerie Dupont',
    });
    expect(screen.getByText('Terminée')).toBeInTheDocument();

    fireEvent.click(item);

    expect(mockNavigate).toHaveBeenCalledWith('/analyse?jobId=job-1');
  });

  it('shows a validation error when the SIREN is invalid', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] });

    renderPage();
    await screen.findByText('Aucune analyse pour le moment. Lancez-en une ci-dessus.');

    fireEvent.change(screen.getByLabelText('SIREN (9 chiffres)'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    expect(
      await screen.findByText('Le SIREN doit comporter 9 chiffres.'),
    ).toBeInTheDocument();
    expect(axiosClient.post).not.toHaveBeenCalled();
  });

  it('launches an analysis and redirects to the tracking page', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] });
    vi.mocked(axiosClient.post).mockResolvedValue({
      data: { job_id: 'job-42', status: 'queued' },
    });

    renderPage();
    await screen.findByText('Aucune analyse pour le moment. Lancez-en une ci-dessus.');

    fireEvent.change(screen.getByLabelText('SIREN (9 chiffres)'), {
      target: { value: '123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/analyse?jobId=job-42'),
    );
  });

  it('shows the backend error message when launching fails', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] });
    vi.mocked(axiosClient.post).mockRejectedValue({
      response: { data: { error: { message: 'SIREN inconnu' } } },
    });

    renderPage();
    await screen.findByText('Aucune analyse pour le moment. Lancez-en une ci-dessus.');

    fireEvent.change(screen.getByLabelText('SIREN (9 chiffres)'), {
      target: { value: '123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    expect(await screen.findByText('SIREN inconnu')).toBeInTheDocument();
  });
});
