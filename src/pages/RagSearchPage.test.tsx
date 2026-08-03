import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import RagSearchPage from './RagSearchPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function renderPage() {
  return renderWithProviders(<RagSearchPage />);
}

const document = {
  id: 1,
  title: 'Conditions générales de vente',
  sourceKind: 'upload',
  language: 'fr',
  status: 'INDEXED' as const,
  chunkCount: 12,
  sizeBytes: 20480,
  ingestedAt: '2026-07-01T09:00:00Z',
  indexedAt: '2026-07-01T09:05:00Z',
  uri: null,
  sourceId: null,
  checksum: 'abc123',
  error: null,
  tags: 'legal,cgv',
  attributes: null,
};

function mockGetByUrl(handlers: Record<string, unknown>) {
  vi.mocked(axiosClient.get).mockImplementation((url: string) => {
    const pathname = url.split('?')[0]; // Isoler le chemin sans query params

    // Cherche si une des clés du mock est contenue dans l'URL appelante
    const matchedKey = Object.keys(handlers).find(key => pathname.endsWith(key) || pathname === key);

    if (matchedKey) {
      return Promise.resolve({ data: handlers[matchedKey] });
    }

    console.error(`[Test Mock Unhandled GET] -> ${url}`);
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

describe('RagSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetByUrl({
      '/api/rag/stats': { documents_total: 3, chunks_total: 42, by_source_kind: { upload: 3 } },
      '/api/rag/documents': { items: [document], total: 1 },
    });
  });

  it('shows the idle state before any search is submitted', async () => {
    renderPage();
    expect(await screen.findByText('Lance une recherche sémantique')).toBeInTheDocument();
    expect(await screen.findByText('Conditions générales de vente')).toBeInTheDocument();
  });

  it('shows a toast error when submitting an empty search', async () => {
    const { toast } = await import('sonner');
    renderPage();
    await screen.findByText('Lance une recherche sémantique');

    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(toast.error).toHaveBeenCalledWith('Saisis une requête de recherche.');
    expect(axiosClient.post).not.toHaveBeenCalled();
  });

  it('renders search results and allows expanding a chunk', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'chunk-1',
            document_id: 7,
            section: 'Article 3',
            tokens: 120,
            score: 0.82,
            text: 'Les modalités de paiement sont détaillées ci-après.',
          },
        ],
      },
    });

    renderPage();
    await screen.findByText('Lance une recherche sémantique');

    fireEvent.change(screen.getByPlaceholderText(/stratégie pricing/), {
      target: { value: 'paiement' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('1 extrait pertinent')).toBeInTheDocument();
    expect(screen.getByText(/modalités de paiement/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Lire l'extrait complet" }));
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeInTheDocument();
  });

  it('shows the empty state when the search returns no chunk', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: { items: [] } });

    renderPage();
    await screen.findByText('Lance une recherche sémantique');

    fireEvent.change(screen.getByPlaceholderText(/stratégie pricing/), {
      target: { value: 'inexistant' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Aucun extrait trouvé')).toBeInTheDocument();
  });

  it('toggles the ask panel and submits a question', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: {
        answer: 'Le paiement est du à 30 jours.',
        grounded: true,
        mock: false,
        model: 'gpt-test',
        elapsed_ms: 500,
        citations: [],
      },
    });

    renderPage();
    await screen.findByText('Lance une recherche sémantique');

    fireEvent.click(screen.getByRole('button', { name: 'Ask IA' }));
    fireEvent.change(screen.getByPlaceholderText(/stratégie pricing/), {
      target: { value: 'Quand payer ?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Générer une réponse' }));

    expect(await screen.findByText('Le paiement est du à 30 jours.')).toBeInTheDocument();
    expect(screen.getByText('grounded')).toBeInTheDocument();
  });

  it('expands a document row to show its details', async () => {
    renderPage();
    const title = await screen.findByText('Conditions générales de vente');

    fireEvent.click(title);

    await waitFor(() => expect(screen.getByText('abc123')).toBeInTheDocument());
  });
});
