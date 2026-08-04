import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import { toast } from 'sonner';
import ConnectorsPage from './ConnectorsPage';

/**
 * Tests de la page Connecteurs : onglets Synchronisations / Webhooks,
 * filtres transmis à l'API, mise en forme des durées et des dates, et
 * suppression protégée par une confirmation.
 */

const hooks = vi.hoisted(() => ({
  useConnectorSyncs: vi.fn(),
  useConnectorWebhooks: vi.fn(),
  useDeleteConnectorSync: vi.fn(),
  useDeleteConnectorWebhook: vi.fn(),
}));

vi.mock('@/api/connectors', async (o) => ({
  ...(await o<typeof import('@/api/connectors')>()),
  ...hooks,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
  ...extra,
});

const mutation = (extra: Record<string, unknown> = {}) => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  ...extra,
});

const sync = (o: Record<string, unknown> = {}) => ({
  id: 1,
  provider: 'google',
  entity: 'messages',
  status: 'SUCCESS',
  trigger: 'manual',
  itemsCount: 42,
  cursor: null,
  error: null,
  durationMs: 2500,
  startedAt: '2026-08-01T10:00:00Z',
  finishedAt: '2026-08-01T10:00:03Z',
  createdAt: '2026-08-01T10:00:00Z',
  connection: { id: 1 },
  tenant: { id: 1 },
  ...o,
});

const webhook = (o: Record<string, unknown> = {}) => ({
  id: 7,
  provider: 'hubspot',
  eventType: 'deal.created',
  externalId: 'evt-9',
  payload: '{"dealId":123}',
  processed: true,
  processedAt: '2026-08-01T11:00:00Z',
  error: null,
  receivedAt: '2026-08-01T10:59:00Z',
  tenant: { id: 1 },
  connection: null,
  ...o,
});

const ongletWebhooks = () =>
  fireEvent.click(screen.getByRole('button', { name: /Webhooks/ }));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.useConnectorSyncs.mockReturnValue(query([sync()]));
  hooks.useConnectorWebhooks.mockReturnValue(query([webhook()]));
  hooks.useDeleteConnectorSync.mockReturnValue(mutation());
  hooks.useDeleteConnectorWebhook.mockReturnValue(mutation());
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('navigation par onglets', () => {
  it('affiche les synchronisations par défaut', () => {
    renderWithProviders(<ConnectorsPage />);

    expect(screen.getByText('Connecteurs')).toBeInTheDocument();
    expect(screen.getByText('messages')).toBeInTheDocument();
    expect(screen.queryByText('deal.created')).toBeNull();
  });

  it('bascule vers les webhooks', () => {
    renderWithProviders(<ConnectorsPage />);

    ongletWebhooks();

    expect(screen.getByText('deal.created')).toBeInTheDocument();
    expect(screen.queryByText('messages')).toBeNull();
  });
});

describe('synchronisations', () => {
  it('transmet les filtres saisis à l’API', async () => {
    renderWithProviders(<ConnectorsPage />);

    fireEvent.change(screen.getByPlaceholderText('google, microsoft, hubspot…'), {
      target: { value: 'microsoft' },
    });
    fireEvent.change(screen.getByPlaceholderText('messages, deals, files…'), {
      target: { value: 'files' },
    });

    await waitFor(() =>
      expect(hooks.useConnectorSyncs).toHaveBeenLastCalledWith(
        'microsoft',
        'files',
        undefined,
      ),
    );
  });

  it('transmet le statut choisi', async () => {
    renderWithProviders(<ConnectorsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Échecs' }));

    await waitFor(() =>
      expect(hooks.useConnectorSyncs).toHaveBeenLastCalledWith(
        undefined,
        undefined,
        'FAILED',
      ),
    );
  });

  it('revient à « tous » sans filtre de statut', async () => {
    renderWithProviders(<ConnectorsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Échecs' }));

    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));

    await waitFor(() =>
      expect(hooks.useConnectorSyncs).toHaveBeenLastCalledWith(
        undefined,
        undefined,
        undefined,
      ),
    );
  });

  it('annonce le chargement', () => {
    hooks.useConnectorSyncs.mockReturnValue(query(undefined, { isLoading: true }));

    renderWithProviders(<ConnectorsPage />);

    expect(
      screen.getByText('Chargement des synchronisations…'),
    ).toBeInTheDocument();
  });

  it('annonce une liste vide', () => {
    hooks.useConnectorSyncs.mockReturnValue(query([]));

    renderWithProviders(<ConnectorsPage />);

    expect(screen.getByText('Aucune synchronisation')).toBeInTheDocument();
  });

  it('relance la requête sur demande', () => {
    const refetch = vi.fn();
    hooks.useConnectorSyncs.mockReturnValue(query([sync()], { refetch }));
    renderWithProviders(<ConnectorsPage />);

    fireEvent.click(screen.getAllByRole('button', { name: /Actualiser/ })[0]);

    expect(refetch).toHaveBeenCalled();
  });
});

describe('mise en forme', () => {
  it('exprime une durée courte en millisecondes', () => {
    hooks.useConnectorSyncs.mockReturnValue(query([sync({ durationMs: 850 })]));

    renderWithProviders(<ConnectorsPage />);

    expect(screen.getByText('850 ms')).toBeInTheDocument();
  });

  it('exprime une durée longue en secondes', () => {
    renderWithProviders(<ConnectorsPage />);

    expect(screen.getByText('2.5 s')).toBeInTheDocument();
  });

  it('remplace les valeurs absentes par un tiret', () => {
    hooks.useConnectorSyncs.mockReturnValue(
      query([sync({ durationMs: null, startedAt: null, finishedAt: null })]),
    );

    renderWithProviders(<ConnectorsPage />);

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('affiche les dates au format français', () => {
    renderWithProviders(<ConnectorsPage />);

    expect(screen.getAllByText(/1 août 2026/).length).toBeGreaterThan(0);
  });

  it.each([
    ['SUCCESS', 'SUCCESS'],
    ['RUNNING', 'RUNNING'],
    ['FAILED', 'FAILED'],
    ['UNKNOWN_STATE', 'UNKNOWN_STATE'],
  ])('affiche le statut %s tel quel', (statut) => {
    hooks.useConnectorSyncs.mockReturnValue(query([sync({ status: statut })]));

    renderWithProviders(<ConnectorsPage />);

    expect(screen.getByText(statut)).toBeInTheDocument();
  });
});

describe('suppression d’une synchronisation', () => {
  const supprimer = () =>
    fireEvent.click(screen.getAllByRole('button', { name: /Supprimer/i })[0]);

  it('demande confirmation en rappelant le contexte', () => {
    renderWithProviders(<ConnectorsPage />);

    supprimer();

    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Supprimer la synchronisation #1 (google · messages) ?',
    );
  });

  it('n’appelle pas l’API si l’utilisateur renonce', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const m = mutation();
    hooks.useDeleteConnectorSync.mockReturnValue(m);
    renderWithProviders(<ConnectorsPage />);

    supprimer();

    expect(m.mutateAsync).not.toHaveBeenCalled();
  });

  it('supprime puis confirme à l’utilisateur', async () => {
    const m = mutation();
    hooks.useDeleteConnectorSync.mockReturnValue(m);
    renderWithProviders(<ConnectorsPage />);

    supprimer();

    await waitFor(() => expect(m.mutateAsync).toHaveBeenCalledWith(1));
    expect(toast.success).toHaveBeenCalledWith('Synchronisation supprimée.');
  });

  it('remonte le message d’erreur du backend', async () => {
    hooks.useDeleteConnectorSync.mockReturnValue(
      mutation({
        mutateAsync: vi.fn().mockRejectedValue({
          response: { data: { error: { message: 'Sync verrouillée' } } },
        }),
      }),
    );
    renderWithProviders(<ConnectorsPage />);

    supprimer();

    expect(await screen.findByText('Sync verrouillée')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Sync verrouillée');
  });

  it('retombe sur le statut HTTP quand le corps ne dit rien', async () => {
    hooks.useDeleteConnectorSync.mockReturnValue(
      mutation({
        mutateAsync: vi.fn().mockRejectedValue({
          response: { statusText: 'Conflict' },
        }),
      }),
    );
    renderWithProviders(<ConnectorsPage />);

    supprimer();

    expect(await screen.findByText('Conflict')).toBeInTheDocument();
  });

  it('retombe sur un message générique pour une erreur opaque', async () => {
    hooks.useDeleteConnectorSync.mockReturnValue(
      mutation({ mutateAsync: vi.fn().mockRejectedValue(new Error('boum')) }),
    );
    renderWithProviders(<ConnectorsPage />);

    supprimer();

    expect(
      await screen.findByText('Une erreur est survenue. Réessayez.'),
    ).toBeInTheDocument();
  });
});

describe('webhooks', () => {
  it('liste les événements reçus', () => {
    renderWithProviders(<ConnectorsPage />);

    ongletWebhooks();

    expect(screen.getByText('deal.created')).toBeInTheDocument();
    expect(screen.getByText('hubspot')).toBeInTheDocument();
  });

  it('traduit le filtre tri-état pour l’API', async () => {
    renderWithProviders(<ConnectorsPage />);
    ongletWebhooks();

    fireEvent.click(screen.getByRole('button', { name: 'Traités' }));
    await waitFor(() =>
      expect(hooks.useConnectorWebhooks).toHaveBeenLastCalledWith(
        undefined,
        true,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'En attente' }));
    await waitFor(() =>
      expect(hooks.useConnectorWebhooks).toHaveBeenLastCalledWith(
        undefined,
        false,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
    await waitFor(() =>
      expect(hooks.useConnectorWebhooks).toHaveBeenLastCalledWith(
        undefined,
        undefined,
      ),
    );
  });

  it('annonce une liste vide', () => {
    hooks.useConnectorWebhooks.mockReturnValue(query([]));
    renderWithProviders(<ConnectorsPage />);

    ongletWebhooks();

    expect(screen.getByText('Aucun webhook')).toBeInTheDocument();
  });

  it('supprime un webhook après confirmation', async () => {
    const m = mutation();
    hooks.useDeleteConnectorWebhook.mockReturnValue(m);
    renderWithProviders(<ConnectorsPage />);
    ongletWebhooks();

    fireEvent.click(screen.getAllByRole('button', { name: /Supprimer/i })[0]);

    expect(globalThis.confirm).toHaveBeenCalled();
    await waitFor(() => expect(m.mutateAsync).toHaveBeenCalledWith(7));
  });
});
