import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import axiosClient from '@/api/axiosClient';
import ModeDirecteurPage from './ModeDirecteurPage';

vi.mock('@/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function renderPage() {
  return renderWithProviders(<ModeDirecteurPage />);
}

const baseInsight = {
  id: 'insight-1',
  kind: 'opportunity',
  category: 'ventes',
  title: 'Relancer un prospect',
  message: 'Un prospect chaud n\'a pas été recontacté depuis 10 jours.',
  rationale: 'Basé sur l\'historique des échanges.',
  tone: 'positive',
  icon: 'sparkles',
  confidence: 0.8,
  priority: 1,
  signals: ['Dernier contact il y a 10 jours'],
  suggested_action: { label: 'Relancer', hint: 'Depuis le CRM', target: '/crm' },
  source: 'crm',
  status: 'active',
  created_at: '2026-07-01T00:00:00Z',
};

const status = {
  active_count: 2,
  dismissed_count: 0,
  by_kind: {},
  by_tone: {},
  last_recalculated_at: null,
  monitored_domains: [],
};

const scheduler = {
  is_live: true,
  monitoring_since: null,
  last_scan_at: null,
  next_scan_at: '2026-07-25T12:00:00Z',
  interval_minutes: 30,
};

describe('ModeDirecteurPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skeleton placeholders while insights are loading', () => {
    vi.mocked(axiosClient.get).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Analyse en cours…')).toBeInTheDocument();
  });

  it('renders the empty state once loading completes with no insight', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: { insights: [], status, scheduler },
    });

    renderPage();

    expect(await screen.findByText('Tout est sous contrôle')).toBeInTheDocument();
    expect(screen.getByText('2 éléments sous surveillance')).toBeInTheDocument();
  });

  it('renders insight cards and dismisses one on demand', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: { insights: [baseInsight], status, scheduler },
    });
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { dismissed: true, id: 'insight-1' } });

    renderPage();

    expect(await screen.findByText('Relancer un prospect')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Écarter cette suggestion/i }));

    await waitFor(() =>
      expect(axiosClient.post).toHaveBeenCalledWith('/api/proactive/dismiss/insight-1'),
    );
    expect(screen.queryByText('Relancer un prospect')).not.toBeInTheDocument();
  });

  it('triggers a recalculation when the button is clicked', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: { insights: [], status: null, scheduler: null },
    });
    vi.mocked(axiosClient.post).mockResolvedValue({
      data: { insights: [], status, scheduler },
    });

    renderPage();

    expect(await screen.findByText('Analyse en cours…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Relancer l'analyse/i }));

    await waitFor(() => expect(axiosClient.post).toHaveBeenCalledWith('/api/proactive/recalculate'));
  });
});
