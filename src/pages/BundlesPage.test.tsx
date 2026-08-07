import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type { StudioBundle } from '@/api/bundles';
import BundlesPage from './BundlesPage';

/**
 * Tests du catalogue des bundles : filtres, activation, suppression et
 * carte de bundle avec son manifest.
 *
 * Le manifest pilote presque tout l'affichage d'une carte (description,
 * version, compteurs, mots-clés) : chacun de ses champs est testé présent
 * puis absent, car un manifest partiel est le cas courant.
 */

const bundles = vi.hoisted(() => ({
  useBundles: vi.fn(),
  useToggleBundle: vi.fn(),
  useDeleteBundle: vi.fn(),
  parseBundleManifest: vi.fn(),
}));

vi.mock('@/api/bundles', () => bundles);

const bundle = (overrides: Partial<StudioBundle> = {}): StudioBundle =>
  ({
    id: 4,
    name: 'Expert-comptable',
    metierSlug: 'expert-comptable',
    isActive: false,
    manifest:
      '{"description":"Bundle comptable","version":"1.2.0","keywords":["bilan","liasse"],"asset_counts":{"prompt":6,"workflow":2}}',
    createdAt: '2026-06-01T09:00:00Z',
    project: { id: 1, title: 'Studio PME' },
    tenant: { id: 1 },
    ...overrides,
  }) as StudioBundle;

function brancher(o: Record<string, unknown> = {}) {
  const toggle = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    variables: undefined,
    ...(o.toggle as object),
  };
  const suppression = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    variables: undefined,
    ...(o.suppression as object),
  };
  const refetch = vi.fn();

  bundles.useBundles.mockReturnValue({
    data: 'liste' in o ? o.liste : [bundle()],
    isLoading: (o.isLoading as boolean) ?? false,
    isFetching: false,
    refetch,
  });
  bundles.useToggleBundle.mockReturnValue(toggle);
  bundles.useDeleteBundle.mockReturnValue(suppression);
  bundles.parseBundleManifest.mockImplementation((raw: string | null) =>
    raw ? JSON.parse(raw) : {},
  );

  return { toggle, suppression, refetch };
}

const afficher = () => renderWithProviders(<BundlesPage />);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  brancher();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Catalogue — liste', () => {
  it('détaille chaque bundle depuis son manifest', () => {
    afficher();

    expect(screen.getByText('Expert-comptable')).toBeInTheDocument();
    expect(screen.getByText('Version 1.2.0')).toBeInTheDocument();
    expect(screen.getByText('Bundle comptable')).toBeInTheDocument();
    expect(screen.getByText('Studio PME')).toBeInTheDocument();
    expect(screen.getByText('Inactif')).toBeInTheDocument();
  });

  it('nomme les compteurs d’actifs connus du référentiel', () => {
    afficher();

    expect(screen.getByText('6 prompts')).toBeInTheDocument();
    expect(screen.getByText('2 workflows')).toBeInTheDocument();
  });

  it('reprend tel quel un type d’actif inconnu', () => {
    brancher({
      liste: [bundle({ manifest: '{"asset_counts":{"connecteur":3}}' })],
    });

    afficher();

    expect(screen.getByText('3 connecteur')).toBeInTheDocument();
  });

  it('affiche les mots-clés du manifest', () => {
    afficher();

    expect(screen.getByText('bilan')).toBeInTheDocument();
    expect(screen.getByText('liasse')).toBeInTheDocument();
  });

  it('tronque les mots-clés au-delà de cinq', () => {
    brancher({
      liste: [bundle({ manifest: '{"keywords":["a","b","c","d","e","f","g"]}' })],
    });

    afficher();

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('signale un manifest sans description', () => {
    brancher({ liste: [bundle({ manifest: '{}' })] });

    afficher();

    expect(screen.getByText('Aucune description dans le manifest.')).toBeInTheDocument();
    expect(screen.queryByText(/^Version/)).not.toBeInTheDocument();
  });

  it('marque un bundle actif', () => {
    brancher({ liste: [bundle({ isActive: true })] });

    afficher();

    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Désactiver' })).toBeInTheDocument();
  });

  it('signale le chargement du catalogue', () => {
    brancher({ liste: [], isLoading: true });

    afficher();

    expect(screen.getByText('Chargement du catalogue…')).toBeInTheDocument();
  });

  it('annonce un catalogue vide', () => {
    brancher({ liste: [] });

    afficher();

    expect(screen.getByText('Aucun bundle')).toBeInTheDocument();
  });

  it('reste stable quand la requête ne renvoie rien du tout', () => {
    brancher({ liste: undefined });

    afficher();

    expect(screen.getByText('Aucun bundle')).toBeInTheDocument();
  });
});

describe('Catalogue — filtres', () => {
  it('n’applique la recherche qu’à la soumission', () => {
    afficher();

    fireEvent.change(screen.getByPlaceholderText('Nom du bundle…'), {
      target: { value: '  compta  ' },
    });
    expect(bundles.useBundles).toHaveBeenLastCalledWith(undefined, undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));

    expect(bundles.useBundles).toHaveBeenLastCalledWith('compta', undefined);
  });

  it('filtre sur les bundles actifs', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Actifs' }));

    expect(bundles.useBundles).toHaveBeenLastCalledWith(undefined, true);
  });

  it('filtre sur les bundles inactifs', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Inactifs' }));

    expect(bundles.useBundles).toHaveBeenLastCalledWith(undefined, false);
  });

  it('revient à tous les bundles', () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Actifs' }));

    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));

    expect(bundles.useBundles).toHaveBeenLastCalledWith(undefined, undefined);
  });

  it('recharge le catalogue à la demande', () => {
    const { refetch } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));

    expect(refetch).toHaveBeenCalled();
  });
});

describe('Catalogue — manifest brut', () => {
  it('déplie puis replie le manifest', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Manifest/ }));
    expect(screen.getByText(/"description":"Bundle comptable"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Masquer/ }));
    expect(screen.queryByText(/"description":"Bundle comptable"/)).not.toBeInTheDocument();
  });

  it('n’affiche rien à déplier quand le bundle n’a pas de manifest', () => {
    brancher({ liste: [bundle({ manifest: null })] });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Manifest/ }));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});

describe('Catalogue — activation', () => {
  it('active un bundle inactif', async () => {
    const { toggle } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Activer' }));

    await waitFor(() =>
      expect(toggle.mutateAsync).toHaveBeenCalledWith({ id: 4, isActive: true }),
    );
  });

  it('désactive un bundle actif', async () => {
    const { toggle } = brancher({ liste: [bundle({ isActive: true })] });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }));

    await waitFor(() =>
      expect(toggle.mutateAsync).toHaveBeenCalledWith({ id: 4, isActive: false }),
    );
  });

  it('remonte l’échec de l’activation', async () => {
    brancher({
      toggle: {
        mutateAsync: vi.fn().mockRejectedValue({
          response: { data: { error: { message: 'Bundle verrouillé' } } },
        }),
      },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Activer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bundle verrouillé');
  });

  it('bloque le bouton du bundle en cours de bascule', () => {
    brancher({ toggle: { isPending: true, variables: { id: 4 } } });

    afficher();

    // Le libellé disparaît au profit du spinner : on vise le bouton par sa position.
    const boutons = screen.getAllByRole('button');
    expect(boutons.some((b) => b.hasAttribute('disabled'))).toBe(true);
  });
});

describe('Catalogue — suppression', () => {
  it('supprime après confirmation', async () => {
    const { suppression } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Expert-comptable'),
    );
    await waitFor(() => expect(suppression.mutateAsync).toHaveBeenCalledWith(4));
  });

  it('ne supprime rien si la confirmation est refusée', () => {
    vi.mocked(globalThis.confirm).mockReturnValue(false);
    const { suppression } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(suppression.mutateAsync).not.toHaveBeenCalled();
  });

  it('retombe sur un message générique quand l’erreur n’a pas de réponse HTTP', async () => {
    brancher({
      suppression: { mutateAsync: vi.fn().mockRejectedValue(new Error('offline')) },
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une erreur est survenue. Réessayez.',
    );
  });
});
