import '@testing-library/jest-dom';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import AnalyticsPage from './AnalyticsPage';

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

function renderPage() {
  return renderWithProviders(<AnalyticsPage />);
}

const event = {
  id: 1,
  eventName: 'analysis_launched',
  category: 'analytics',
  valueNum: 1,
  durationMs: 245,
  properties: '{"siren":"123456789"}',
  occurredAt: '2026-07-01T09:00:00Z',
  subjectKind: 'company',
  subjectId: '123456789',
  sessionId: 'sess-1',
  tenant: { id: 1, name: 'demo' },
  user: null,
};

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when there is no event', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { content: [] } });

    renderPage();

    expect(await screen.findByText('Aucun événement')).toBeInTheDocument();
  });

  it('renders the events table and expands a row to show details', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { content: [event] } });

    renderPage();

    expect(await screen.findByText('analysis_launched')).toBeInTheDocument();
    expect(screen.getByText('245 ms')).toBeInTheDocument();

    fireEvent.click(screen.getByText('analysis_launched'));

    expect(await screen.findByText('company · 123456789')).toBeInTheDocument();
    expect(screen.getByText('sess-1')).toBeInTheDocument();
  });

  it('filters events by search term', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { content: [event] } });

    renderPage();
    await screen.findByText('analysis_launched');

    fireEvent.change(screen.getByPlaceholderText('Nom d’événement…'), {
      target: { value: 'analysis' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));

    expect(axiosClient.get).toHaveBeenCalledWith(
      '/api/analytics-events',
      expect.objectContaining({
        params: expect.objectContaining({ 'eventName.contains': 'analysis' }),
      }),
    );
  });
});
