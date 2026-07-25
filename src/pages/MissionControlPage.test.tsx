import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import MissionControlPage from './MissionControlPage';

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderPage() {
  return renderWithProviders(<MissionControlPage />);
}

const priority = {
  id: 1,
  label: 'Signer 3 nouveaux clients',
  kind: 'GOAL' as const,
  horizon: 'MONTH' as const,
  weight: 5,
  status: 'active',
  createdAt: '2026-07-01T00:00:00Z',
};

describe('MissionControlPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when there is no active priority', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] });

    renderPage();

    expect(
      await screen.findByText((content) => content.includes('Aucune priorité')),
    ).toBeInTheDocument();
  });

  it('renders a priority grouped by horizon and marks it as achieved', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [priority] });
    vi.mocked(axiosClient.patch).mockResolvedValue({
      data: { ...priority, status: 'achieved' },
    });

    renderPage();

    expect(await screen.findByText('Signer 3 nouveaux clients')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Marquer comme atteinte'));

    await waitFor(() => expect(axiosClient.patch).toHaveBeenCalled());
    expect(axiosClient.patch).toHaveBeenCalledWith(
      '/api/user-priorities/1',
      { id: 1, status: 'achieved' },
      expect.anything(),
    );
  });

  it('deletes a priority when the delete button is used', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [priority] });
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: {} });

    renderPage();

    expect(await screen.findByText('Signer 3 nouveaux clients')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Supprimer'));

    await waitFor(() =>
      expect(axiosClient.delete).toHaveBeenCalledWith('/api/user-priorities/1'),
    );
  });

  it('creates a priority from the form and shows a validation error when the label is empty', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] });
    vi.mocked(axiosClient.post).mockResolvedValue({
      data: { priority, mission_summary: null },
    });

    renderPage();

    await screen.findByText((content) => content.includes('Aucune priorité'));

    fireEvent.click(screen.getByRole('button', { name: /Ajouter/i }));
    expect(await screen.findByText('Le libellé est obligatoire.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Libellé'), {
      target: { value: 'Signer 3 nouveaux clients' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/i }));

    await waitFor(() =>
      expect(axiosClient.post).toHaveBeenCalledWith(
        '/api/copilot/v2/priorities',
        expect.objectContaining({ label: 'Signer 3 nouveaux clients' }),
      ),
    );
  });
});
