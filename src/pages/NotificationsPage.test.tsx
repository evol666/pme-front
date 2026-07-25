import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import NotificationsPage from './NotificationsPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderPage() {
  return renderWithProviders(<NotificationsPage />);
}

const notification = {
  id: 1,
  kind: 'ALERT' as const,
  priority: 'HIGH' as const,
  status: 'SENT' as const,
  title: 'Facture impayée détectée',
  summary: 'Une facture est en retard de paiement depuis 30 jours.',
  body: null,
  ctaLabel: null,
  ctaUrl: null,
  channels: null,
  createdAt: '2026-07-01T09:00:00Z',
};

function mockGetByUrl(handlers: Record<string, { data: unknown; headers?: Record<string, string> }>) {
  vi.mocked(axiosClient.get).mockImplementation((url: string) => {
    for (const key of Object.keys(handlers)) {
      if (url.startsWith(key)) {
        return Promise.resolve(handlers[key]);
      }
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  it('renders the empty state when there is no notification', async () => {
    mockGetByUrl({
      '/api/notifications': { data: [], headers: { 'x-total-count': '0' } },
      '/api/notification-digests': { data: [] },
      '/api/notification-center/unread-count': { data: { unread_count: 0 } },
    });

    renderPage();

    expect(await screen.findByText('Aucune notification correspondante')).toBeInTheDocument();
    expect(screen.getByText("Aucun digest pour l’instant. Les synthèses périodiques apparaîtront ici.")).toBeInTheDocument();
  });

  it('renders a notification and marks it read', async () => {
    mockGetByUrl({
      '/api/notifications': { data: [notification], headers: { 'x-total-count': '1' } },
      '/api/notification-digests': { data: [] },
      '/api/notification-center/unread-count': { data: { unread_count: 1 } },
    });
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: {} });

    renderPage();

    expect(await screen.findByText('Facture impayée détectée')).toBeInTheDocument();
    expect(screen.getByText('1 non lue')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Marquer lu' }));

    await waitFor(() => expect(axiosClient.patch).toHaveBeenCalled());
  });

  it('deletes a notification after user confirmation', async () => {
    mockGetByUrl({
      '/api/notifications': { data: [notification], headers: { 'x-total-count': '1' } },
      '/api/notification-digests': { data: [] },
      '/api/notification-center/unread-count': { data: { unread_count: 1 } },
    });
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: {} });

    renderPage();

    expect(await screen.findByText('Facture impayée détectée')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/i }));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Supprimer la notification « Facture impayée détectée » ? Cette action est définitive.',
    );
    await waitFor(() =>
      expect(axiosClient.delete).toHaveBeenCalledWith('/api/notifications/1'),
    );
  });

  it('does not delete when the user cancels the confirmation', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    mockGetByUrl({
      '/api/notifications': { data: [notification], headers: { 'x-total-count': '1' } },
      '/api/notification-digests': { data: [] },
      '/api/notification-center/unread-count': { data: { unread_count: 1 } },
    });

    renderPage();

    expect(await screen.findByText('Facture impayée détectée')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/i }));

    expect(axiosClient.delete).not.toHaveBeenCalled();
  });

  it('shows digests when available', async () => {
    mockGetByUrl({
      '/api/notifications': { data: [], headers: { 'x-total-count': '0' } },
      '/api/notification-digests': {
        data: [
          {
            id: 5,
            kind: 'DAILY',
            subject: 'Résumé du jour',
            summary: 'Synthèse des évènements notables.',
            createdAt: '2026-07-01T08:00:00Z',
          },
        ],
      },
      '/api/notification-center/unread-count': { data: { unread_count: 0 } },
    });

    renderPage();

    expect(await screen.findByText('Résumé du jour')).toBeInTheDocument();
  });
});
