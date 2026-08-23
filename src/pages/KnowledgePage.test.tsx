import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type { KnowledgeEntity, KnowledgeSignal } from '@/api/knowledge';
import KnowledgePage from './KnowledgePage';

/**
 * Tests de la mémoire stratégique : onglet des signaux (filtres, résolution,
 * suppression) et onglet des entités (recherche, détail dépliable).
 *
 * `entityIds` et `tags` arrivent en @Lob JSON : leur parsing défensif est
 * vérifié sur des chaînes valides, vides et mal formées, car une exception ici
 * casserait toute la grille.
 */

const knowledge = vi.hoisted(() => ({
  useKnowledgeSignals: vi.fn(),
  useKnowledgeEntities: vi.fn(),
  useResolveKnowledgeSignal: vi.fn(),
  useDeleteKnowledgeSignal: vi.fn(),
  useDeleteKnowledgeEntity: vi.fn(),
}));

vi.mock('@/api/knowledge', () => knowledge);

const signal = (overrides: Partial<KnowledgeSignal> = {}): KnowledgeSignal =>
  ({
    id: 11,
    kind: 'risk',
    title: 'Retard de paiement récurrent',
    summary: 'Trois factures en retard sur le dernier trimestre.',
    severity: 'HIGH',
    score: 0.82,
    entityIds: '[4,7]',
    evidence: null,
    status: 'open',
    createdAt: '2026-08-01T09:00:00Z',
    resolvedAt: null,
    tenant: { id: 1 },
    ...overrides,
  }) as KnowledgeSignal;

const entite = (overrides: Partial<KnowledgeEntity> = {}): KnowledgeEntity =>
  ({
    id: 4,
    kind: 'company',
    externalId: '414056309',
    label: 'Translog',
    description: 'Transporteur régional.',
    source: 'sirene',
    status: 'actif',
    score: 0.66,
    attributes: '{"effectif":42}',
    tags: '["client","prioritaire"]',
    firstSeenAt: '2026-01-05T09:00:00Z',
    lastSeenAt: '2026-08-01T09:00:00Z',
    createdAt: '2026-01-05T09:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
    tenant: { id: 1 },
    ...overrides,
  }) as KnowledgeEntity;

function requete(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function brancher(o: Record<string, unknown> = {}) {
  const resoudre = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    variables: undefined,
    ...(o.resoudre as object),
  };
  const supprimerSignal = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    variables: undefined,
    ...(o.supprimerSignal as object),
  };
  const supprimerEntite = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    variables: undefined,
    ...(o.supprimerEntite as object),
  };
  const refetchSignaux = vi.fn();

  knowledge.useKnowledgeSignals.mockReturnValue(
    requete('signaux' in o ? o.signaux : [signal()], {
      refetch: refetchSignaux,
      ...(o.signauxQuery as object),
    }),
  );
  knowledge.useKnowledgeEntities.mockReturnValue(
    requete('entites' in o ? o.entites : [entite()], o.entitesQuery as object),
  );
  knowledge.useResolveKnowledgeSignal.mockReturnValue(resoudre);
  knowledge.useDeleteKnowledgeSignal.mockReturnValue(supprimerSignal);
  knowledge.useDeleteKnowledgeEntity.mockReturnValue(supprimerEntite);

  return { resoudre, supprimerSignal, supprimerEntite, refetchSignaux };
}

const afficher = () => renderWithProviders(<KnowledgePage />);

const ouvrirEntites = () =>
  fireEvent.click(screen.getByRole('button', { name: /Entités/ }));

beforeEach(() => {
  vi.clearAllMocks();
  brancher();
});

describe('Mémoire — navigation', () => {
  it('ouvre sur les signaux', () => {
    afficher();

    expect(screen.getByText('Retard de paiement récurrent')).toBeInTheDocument();
  });

  it('bascule sur les entités', () => {
    afficher();

    ouvrirEntites();

    expect(screen.getByText('Translog')).toBeInTheDocument();
  });
});

describe('Mémoire — signaux', () => {
  it('détaille le signal, sa sévérité et son score', () => {
    afficher();

    // « Élevé » figure aussi dans le sélecteur de sévérité.
    expect(screen.getAllByText('Élevé')).toHaveLength(2);
    expect(screen.getByText('risk')).toBeInTheDocument();
    expect(screen.getByText('Score 0.82')).toBeInTheDocument();
    expect(screen.getByText('2 entité(s) liée(s)')).toBeInTheDocument();
  });

  it('reprend tel quel un statut inconnu du référentiel', () => {
    brancher({ signaux: [signal({ status: 'snoozed' })] });

    afficher();

    expect(screen.getByText('snoozed')).toBeInTheDocument();
  });

  it('affiche la date de résolution d’un signal traité', () => {
    brancher({
      signaux: [signal({ status: 'resolved', resolvedAt: '2026-08-03T10:00:00Z' })],
    });

    afficher();

    expect(screen.getByText(/^Résolu /)).toBeInTheDocument();
    // Un signal déjà résolu ne propose plus de l'être.
    expect(
      screen.queryByRole('button', { name: /Marquer résolu/ }),
    ).not.toBeInTheDocument();
  });

  it('tolère une liste d’entités liées mal formée', () => {
    brancher({ signaux: [signal({ entityIds: '{pas un tableau', summary: null })] });

    afficher();

    // Le parsing échoue silencieusement : la carte reste affichée.
    expect(screen.getByText('Retard de paiement récurrent')).toBeInTheDocument();
    expect(screen.queryByText(/entité\(s\) liée\(s\)/)).not.toBeInTheDocument();
  });

  it('résout un signal', async () => {
    const { resoudre } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Marquer résolu/ }));

    await waitFor(() => expect(resoudre.mutateAsync).toHaveBeenCalledWith(11));
  });

  it('remonte l’échec de la résolution', async () => {
    brancher({
      resoudre: {
        mutateAsync: vi.fn().mockRejectedValue({
          response: { data: { error: { message: 'Signal déjà traité' } } },
        }),
      },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Marquer résolu/ }));

    expect(await screen.findByText('Signal déjà traité')).toBeInTheDocument();
  });

  it('supprime un signal', async () => {
    const { supprimerSignal } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    await waitFor(() => expect(supprimerSignal.mutateAsync).toHaveBeenCalledWith(11));
  });

  it('retombe sur un message générique quand la suppression échoue sans réponse', async () => {
    brancher({
      supprimerSignal: { mutateAsync: vi.fn().mockRejectedValue(new Error('offline')) },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(
      await screen.findByText('Une erreur est survenue. Réessayez.'),
    ).toBeInTheDocument();
  });

  it('filtre par statut, sévérité et type', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Résolus' }));
    expect(knowledge.useKnowledgeSignals).toHaveBeenLastCalledWith(
      'resolved',
      undefined,
      undefined,
    );

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'CRITICAL' },
    });
    expect(knowledge.useKnowledgeSignals).toHaveBeenLastCalledWith(
      'resolved',
      undefined,
      'CRITICAL',
    );

    fireEvent.change(screen.getByPlaceholderText(/Filtrer par type/), {
      target: { value: ' trend ' },
    });
    expect(knowledge.useKnowledgeSignals).toHaveBeenLastCalledWith(
      'resolved',
      'trend',
      'CRITICAL',
    );
  });

  it('revient à tous les statuts', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));

    expect(knowledge.useKnowledgeSignals).toHaveBeenLastCalledWith(
      undefined,
      undefined,
      undefined,
    );
  });

  it('recharge les signaux à la demande', () => {
    const { refetchSignaux } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));

    expect(refetchSignaux).toHaveBeenCalled();
  });

  it('signale le chargement, l’erreur puis le vide', () => {
    brancher({ signaux: [], signauxQuery: { isLoading: true } });
    const { unmount } = afficher();
    expect(screen.getByText('Chargement des signaux…')).toBeInTheDocument();
    unmount();

    brancher({
      signaux: [],
      signauxQuery: { isError: true, error: { response: { statusText: 'Gone' } } },
    });
    const seconde = afficher();
    expect(screen.getByText('Gone')).toBeInTheDocument();
    seconde.unmount();

    brancher({ signaux: [] });
    afficher();
    expect(screen.getByText('Aucun signal')).toBeInTheDocument();
  });
});

describe('Mémoire — entités', () => {
  const ouvrir = () => {
    afficher();
    ouvrirEntites();
  };

  it('détaille l’entité, son type et ses tags', () => {
    ouvrir();

    // « Entreprise » figure aussi dans le sélecteur de type.
    expect(screen.getAllByText('Entreprise')).toHaveLength(2);
    expect(screen.getByText('Translog')).toBeInTheDocument();
    expect(screen.getByText('client')).toBeInTheDocument();
    expect(screen.getByText('Score 0.66')).toBeInTheDocument();
    expect(screen.getByText(/Source : sirene/)).toBeInTheDocument();
  });

  it('reprend tel quel un type d’entité inconnu', () => {
    brancher({ entites: [entite({ kind: 'brevet' })] });
    ouvrir();

    expect(screen.getByText('brevet')).toBeInTheDocument();
  });

  it('tronque les tags au-delà de six', () => {
    brancher({
      entites: [entite({ tags: '["a","b","c","d","e","f","g","h"]' })],
    });
    ouvrir();

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('omet score, statut, description et source quand ils sont absents', () => {
    brancher({
      entites: [
        entite({ score: null, status: null, description: null, source: null, tags: null }),
      ],
    });
    ouvrir();

    expect(screen.queryByText(/^Score/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source :/)).not.toBeInTheDocument();
  });

  it('déplie puis replie le détail d’une entité', () => {
    ouvrir();

    fireEvent.click(screen.getByRole('button', { name: 'Voir le détail' }));
    expect(screen.getByText(/ID externe/)).toBeInTheDocument();
    expect(screen.getByText(/"effectif":42/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Masquer le détail' }));
    expect(screen.queryByText(/ID externe/)).not.toBeInTheDocument();
  });

  it('n’affiche pas d’identifiant externe quand il n’y en a pas', () => {
    brancher({ entites: [entite({ externalId: null, attributes: null })] });
    ouvrir();

    fireEvent.click(screen.getByRole('button', { name: 'Voir le détail' }));

    expect(screen.queryByText(/ID externe/)).not.toBeInTheDocument();
    expect(screen.getByText(/Vu la 1re fois/)).toBeInTheDocument();
  });

  it('n’applique la recherche qu’à la soumission', () => {
    ouvrir();

    fireEvent.change(screen.getByPlaceholderText(/Rechercher par libellé/), {
      target: { value: 'translog' },
    });
    expect(knowledge.useKnowledgeEntities).toHaveBeenLastCalledWith(
      undefined,
      undefined,
      undefined,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(knowledge.useKnowledgeEntities).toHaveBeenLastCalledWith(
      undefined,
      undefined,
      'translog',
    );
  });

  it('filtre par type d’entité', () => {
    ouvrir();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'contact' } });

    expect(knowledge.useKnowledgeEntities).toHaveBeenLastCalledWith(
      'contact',
      undefined,
      undefined,
    );
  });

  it('supprime une entité', async () => {
    const { supprimerEntite } = brancher();
    ouvrir();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    await waitFor(() => expect(supprimerEntite.mutateAsync).toHaveBeenCalledWith(4));
  });

  it('remonte l’échec de la suppression d’entité', async () => {
    brancher({
      supprimerEntite: {
        mutateAsync: vi.fn().mockRejectedValue({
          response: { data: { error: { message: 'Entité référencée' } } },
        }),
      },
    });
    ouvrir();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(await screen.findByText('Entité référencée')).toBeInTheDocument();
  });

  it('annonce l’absence d’entité', () => {
    brancher({ entites: [] });
    ouvrir();

    expect(screen.getByText('Aucune entité')).toBeInTheDocument();
  });

  it('remonte une erreur de chargement des entités', () => {
    brancher({
      entites: [],
      entitesQuery: { isError: true, error: { response: { statusText: 'Forbidden' } } },
    });
    ouvrir();

    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });
});
