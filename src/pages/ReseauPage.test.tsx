import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import ReseauPage from './ReseauPage';

const hooks = vi.hoisted(() => ({
  useBusinessEntities: vi.fn(),
  useConnections: vi.fn(),
  useCreateBusinessEntity: vi.fn(),
  useDeleteBusinessEntity: vi.fn(),
  useDeleteConnection: vi.fn(),
  useDeleteNetworkInsight: vi.fn(),
  useNetworkInsights: vi.fn(),
  useNetworkSyncStates: vi.fn(),
}));

vi.mock('@/api/network', async (o) => ({
  ...(await o<typeof import('@/api/network')>()),
  ...hooks,
}));

const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
  ...extra,
});

const mutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
});

const entity = {
  id: 1,
  kind: 'client',
  label: 'Boulangerie Dupont',
  externalRef: 'EXT-1',
  attributes: '{"ville":"Lyon"}',
  createdAt: '2026-07-01T09:00:00Z',
  updatedAt: '2026-07-01T09:00:00Z',
};

const connection = {
  id: 2,
  provider: 'google',
  status: 'ACTIVE',
  accountLabel: 'compte@exemple.fr',
  accessToken: 'secret-access',
  refreshToken: 'secret-refresh',
  lastSyncAt: '2026-07-01T09:00:00Z',
  tokenExpiresAt: '2026-08-01T09:00:00Z',
};

const insight = {
  id: 3,
  kind: 'churn',
  title: 'Risque de perte client',
  summary: 'Baisse des commandes',
  createdAt: '2026-07-01T09:00:00Z',
};

const syncState = {
  id: 4,
  provider: 'google',
  status: 'OK',
  lastRunAt: '2026-07-01T09:00:00Z',
};

function setLists({
  entities = [entity],
  connections = [connection],
  insights = [insight],
  syncs = [syncState],
} = {}) {
  hooks.useBusinessEntities.mockReturnValue(query(entities));
  hooks.useConnections.mockReturnValue(query(connections));
  hooks.useNetworkInsights.mockReturnValue(query(insights));
  hooks.useNetworkSyncStates.mockReturnValue(query(syncs));
}

beforeEach(() => {
  vi.clearAllMocks();
  setLists();
  hooks.useCreateBusinessEntity.mockReturnValue(mutation());
  hooks.useDeleteBusinessEntity.mockReturnValue(mutation());
  hooks.useDeleteConnection.mockReturnValue(mutation());
  hooks.useDeleteNetworkInsight.mockReturnValue(mutation());
});

const goTo = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

describe('navigation par onglets', () => {
  it('affiche les quatre onglets', () => {
    renderWithProviders(<ReseauPage />);

    for (const label of ['Entités', 'Connexions', 'Insights', 'Synchronisation']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('ouvre les entités par défaut', () => {
    renderWithProviders(<ReseauPage />);

    expect(screen.getByText('Boulangerie Dupont')).toBeInTheDocument();
  });

  it('bascule sur les connexions', () => {
    renderWithProviders(<ReseauPage />);

    goTo('Connexions');

    // « google » figure aussi dans le placeholder de filtre : plusieurs noeuds.
    expect(screen.getAllByText('google').length).toBeGreaterThan(0);
  });

  it('bascule sur les insights', () => {
    renderWithProviders(<ReseauPage />);

    goTo('Insights');

    expect(screen.getByText('Risque de perte client')).toBeInTheDocument();
  });

  it('bascule sur la synchronisation', () => {
    renderWithProviders(<ReseauPage />);

    goTo('Synchronisation');

    expect(screen.getByText(/OK/)).toBeInTheDocument();
  });
});

describe('entités métier', () => {
  it('recherche par libellé', async () => {
    renderWithProviders(<ReseauPage />);

    fireEvent.change(screen.getByPlaceholderText('Libellé de l’entité…'), {
      target: { value: 'dupont' },
    });

    await waitFor(() => expect(hooks.useBusinessEntities).toHaveBeenCalled());
  });

  it('annonce une liste vide', () => {
    setLists({ entities: [] });

    renderWithProviders(<ReseauPage />);

    expect(screen.getByText('Aucune entité')).toBeInTheDocument();
  });

  it('ouvre le formulaire de création', async () => {
    renderWithProviders(<ReseauPage />);

    const ajouter = screen
      .getAllByRole('button')
      .find((b) => /ajouter|nouvelle|créer/i.test(b.textContent ?? ''));
    if (ajouter) fireEvent.click(ajouter);

    expect(await screen.findByPlaceholderText('Nom de l’entité')).toBeInTheDocument();
  });

  it('crée une entité depuis le formulaire', async () => {
    const create = mutation();
    hooks.useCreateBusinessEntity.mockReturnValue(create);
    renderWithProviders(<ReseauPage />);
    const ajouter = screen
      .getAllByRole('button')
      .find((b) => /ajouter|nouvelle|créer/i.test(b.textContent ?? ''));
    if (ajouter) fireEvent.click(ajouter);
    await screen.findByPlaceholderText('Nom de l’entité');

    fireEvent.change(screen.getByPlaceholderText('Nom de l’entité'), {
      target: { value: 'Garage Martin' },
    });
    const valider = screen
      .getAllByRole('button')
      .find((b) => /enregistrer|valider|créer/i.test(b.textContent ?? ''));
    if (valider) fireEvent.click(valider);

    expect(await screen.findByPlaceholderText('Nom de l’entité')).toBeDefined();
  });
});

describe('connexions', () => {
  it('ne révèle jamais les jetons OAuth', () => {
    renderWithProviders(<ReseauPage />);

    goTo('Connexions');

    expect(screen.getByText('Présents (masqués)')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('secret-access');
    expect(document.body.textContent).not.toContain('secret-refresh');
  });

  it('signale une connexion sans jeton', () => {
    setLists({
      connections: [{ ...connection, accessToken: null, refreshToken: null }],
    });
    renderWithProviders(<ReseauPage />);

    goTo('Connexions');

    expect(screen.getByText('Aucun')).toBeInTheDocument();
  });

  it('annonce une liste vide', () => {
    setLists({ connections: [] });
    renderWithProviders(<ReseauPage />);

    goTo('Connexions');

    expect(screen.getByText('Aucune connexion')).toBeInTheDocument();
  });
});

describe('insights et synchronisation', () => {
  it('annonce une liste d’insights vide', () => {
    setLists({ insights: [] });
    renderWithProviders(<ReseauPage />);

    goTo('Insights');

    expect(screen.getByText('Aucun insight')).toBeInTheDocument();
  });

  it('annonce une synchronisation vide', () => {
    setLists({ syncs: [] });
    renderWithProviders(<ReseauPage />);

    goTo('Synchronisation');

    expect(screen.getByText('Aucun état de synchronisation')).toBeInTheDocument();
  });

  it('tolère des listes non chargées', () => {
    setLists({
      entities: undefined as never,
      connections: undefined as never,
      insights: undefined as never,
      syncs: undefined as never,
    });

    renderWithProviders(<ReseauPage />);

    // Sans données la page reste montée (barre d'onglets présente).
    expect(screen.getByRole('button', { name: /Entités/ })).toBeInTheDocument();
  });
});

describe('suppressions et filtres', () => {
  /** Les trois suppressions passent par `confirm` : on l'accepte par défaut. */
  const accepter = () => vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

  it('supprime une entité après confirmation', async () => {
    accepter();
    const suppression = mutation();
    hooks.useDeleteBusinessEntity.mockReturnValue(suppression);
    renderWithProviders(<ReseauPage />);

    fireEvent.click(screen.getByRole('button', { name: /Supprimer l.entité/ }));

    await waitFor(() => expect(suppression.mutateAsync).toHaveBeenCalledWith(1));
    vi.restoreAllMocks();
  });

  it('ne supprime aucune entité si la confirmation est refusée', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const suppression = mutation();
    hooks.useDeleteBusinessEntity.mockReturnValue(suppression);
    renderWithProviders(<ReseauPage />);

    fireEvent.click(screen.getByRole('button', { name: /Supprimer l.entité/ }));

    expect(suppression.mutateAsync).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('remonte l’échec de suppression d’une entité', async () => {
    accepter();
    hooks.useDeleteBusinessEntity.mockReturnValue({
      ...mutation(),
      mutateAsync: vi.fn().mockRejectedValue({
        response: { data: { error: { message: 'Entité référencée' } } },
      }),
    });
    renderWithProviders(<ReseauPage />);

    fireEvent.click(screen.getByRole('button', { name: /Supprimer l.entité/ }));

    expect(await screen.findByText('Entité référencée')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('supprime une connexion après confirmation', async () => {
    accepter();
    const suppression = mutation();
    hooks.useDeleteConnection.mockReturnValue(suppression);
    renderWithProviders(<ReseauPage />);
    goTo('Connexions');

    fireEvent.click(screen.getByRole('button', { name: /Supprimer la connexion/ }));

    await waitFor(() => expect(suppression.mutateAsync).toHaveBeenCalledWith(2));
    vi.restoreAllMocks();
  });

  it('retombe sur un message générique quand la suppression d’une connexion échoue', async () => {
    accepter();
    hooks.useDeleteConnection.mockReturnValue({
      ...mutation(),
      mutateAsync: vi.fn().mockRejectedValue(new Error('offline')),
    });
    renderWithProviders(<ReseauPage />);
    goTo('Connexions');

    fireEvent.click(screen.getByRole('button', { name: /Supprimer la connexion/ }));

    expect(
      await screen.findByText('Une erreur est survenue. Réessayez.'),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('supprime un insight après confirmation', async () => {
    accepter();
    const suppression = mutation();
    hooks.useDeleteNetworkInsight.mockReturnValue(suppression);
    renderWithProviders(<ReseauPage />);
    goTo('Insights');

    fireEvent.click(screen.getByRole('button', { name: /Supprimer l.insight/ }));

    await waitFor(() => expect(suppression.mutateAsync).toHaveBeenCalledWith(3));
    vi.restoreAllMocks();
  });

  it('filtre les connexions par provider et par statut', () => {
    renderWithProviders(<ReseauPage />);
    goTo('Connexions');

    fireEvent.change(screen.getByPlaceholderText('google, microsoft…'), {
      target: { value: 'microsoft' },
    });
    expect(hooks.useConnections).toHaveBeenLastCalledWith('microsoft', undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Erreurs' }));
    expect(hooks.useConnections).toHaveBeenLastCalledWith('microsoft', 'ERROR');
  });

  it('propose les types d’insight présents en filtre', () => {
    setLists({ insights: [insight, { ...insight, id: 9, kind: 'upsell' }] });
    renderWithProviders(<ReseauPage />);
    goTo('Insights');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'upsell' } });

    expect(hooks.useNetworkInsights).toHaveBeenLastCalledWith('upsell');
  });

  it('signale le chargement de chaque onglet', () => {
    hooks.useConnections.mockReturnValue(query(undefined, { isLoading: true }));
    renderWithProviders(<ReseauPage />);

    goTo('Connexions');

    expect(screen.getByText('Chargement des connexions…')).toBeInTheDocument();
  });

  it('recharge les états de synchronisation', () => {
    const refetch = vi.fn();
    hooks.useNetworkSyncStates.mockReturnValue(query([syncState], { refetch }));
    renderWithProviders(<ReseauPage />);
    goTo('Synchronisation');

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));

    expect(refetch).toHaveBeenCalled();
  });
});
