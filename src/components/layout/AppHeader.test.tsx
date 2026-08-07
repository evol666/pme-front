import '@testing-library/jest-dom';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import { logout } from '@/api/auth';
import { AppHeader } from './AppHeader';

/**
 * Tests de l'en-tête applicatif : menu utilisateur, cloche de notifications
 * et sélecteur de persona.
 *
 * Les trois menus se ferment de la même façon (clic extérieur ou Échap) et
 * aucun ne l'était vérifié : un menu qui reste ouvert masque le contenu.
 */

const navMock = vi.hoisted(() => vi.fn());
const personaStore = vi.hoisted(() => ({
  activePersonaId: null as number | null,
  setActivePersona: vi.fn(),
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navMock,
}));
vi.mock('@/api/auth', () => ({ logout: vi.fn() }));
vi.mock('@/api/notifications', () => ({ useUnreadNotificationCount: vi.fn() }));
vi.mock('@/api/personas', () => ({ usePersonas: vi.fn() }));
vi.mock('@/components/recherche/EntrepriseSearchBar', () => ({
  EntrepriseSearchBar: () => <div>recherche entreprise</div>,
}));
vi.mock('@/components/theme/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">thème</button>,
}));
vi.mock('@/app/hooks', () => ({ useAppSelector: vi.fn() }));
vi.mock('@/stores/personaStore', () => ({
  usePersonaStore: (selecteur: (s: typeof personaStore) => unknown) =>
    selecteur(personaStore),
}));

import { useUnreadNotificationCount } from '@/api/notifications';
import { usePersonas } from '@/api/personas';
import { useAppSelector } from '@/app/hooks';

function brancher(o: Record<string, unknown> = {}) {
  vi.mocked(useAppSelector).mockReturnValue({
    username: 'unread' in o ? o.username : 'alice',
  } as never);
  vi.mocked(useUnreadNotificationCount).mockReturnValue({
    data: { unreadCount: (o.unread as number) ?? 0 },
  } as never);
  vi.mocked(usePersonas).mockReturnValue({
    data: 'personas' in o ? o.personas : [{ id: 1, role: 'Dirigeant' }, { id: 2, role: null }],
    isLoading: (o.personasLoading as boolean) ?? false,
  } as never);
  personaStore.activePersonaId = (o.activePersonaId as number | null) ?? null;
}

const afficher = (props = {}) =>
  renderWithProviders(<AppHeader {...props} />);

/** Ouvre le menu utilisateur, repéré par le nom affiché. */
const ouvrirMenuUtilisateur = () =>
  fireEvent.click(screen.getByRole('button', { name: /alice/ }));

beforeEach(() => {
  vi.clearAllMocks();
  personaStore.setActivePersona.mockReset();
  brancher();
});

describe('En-tête — menu utilisateur', () => {
  it('affiche l’initiale et le nom de l’utilisateur', () => {
    afficher();

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('retombe sur « U » quand aucun nom n’est connu', () => {
    vi.mocked(useAppSelector).mockReturnValue({ username: undefined } as never);

    afficher();

    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('ouvre puis referme le menu au clic extérieur', () => {
    afficher();

    ouvrirMenuUtilisateur();
    expect(screen.getByText('Connecté en tant que')).toBeInTheDocument();

    fireEvent.click(document.querySelector('.fixed.inset-0.z-40') as HTMLElement);
    expect(screen.queryByText('Connecté en tant que')).not.toBeInTheDocument();
  });

  it('referme le menu à la touche Échap', () => {
    afficher();
    ouvrirMenuUtilisateur();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Connecté en tant que')).not.toBeInTheDocument();
  });

  it('ignore Échap quand le menu est fermé', () => {
    afficher();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Connecté en tant que')).not.toBeInTheDocument();
  });

  it('déconnecte depuis le menu', () => {
    afficher();
    ouvrirMenuUtilisateur();

    fireEvent.click(screen.getByRole('button', { name: /Déconnexion/ }));

    expect(logout).toHaveBeenCalled();
  });
});

describe('En-tête — notifications', () => {
  it('n’affiche aucun badge sans notification non lue', () => {
    afficher();

    expect(
      screen.getByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });

  it('affiche le nombre de notifications non lues', () => {
    brancher({ unread: 7 });

    afficher();

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notifications (7 non lues)' }),
    ).toBeInTheDocument();
  });

  it('plafonne l’affichage au-delà de 99', () => {
    brancher({ unread: 250 });

    afficher();

    // Un badge à trois chiffres déborderait de sa pastille.
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('ouvre la page des notifications', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));

    expect(navMock).toHaveBeenCalledWith('/notifications');
  });
});

describe('En-tête — sélecteur de persona', () => {
  // Le nom accessible du bouton est son libellé courant : on le repère au titre.
  const ouvrirPersonas = () =>
    fireEvent.click(screen.getByTitle('Changer de persona'));

  it('masque le sélecteur tant que la liste charge', () => {
    brancher({ personas: undefined, personasLoading: true });

    afficher();

    expect(screen.queryByTitle('Changer de persona')).not.toBeInTheDocument();
  });

  it('masque le sélecteur quand aucun persona n’est défini', () => {
    brancher({ personas: [] });

    afficher();

    expect(screen.queryByTitle('Changer de persona')).not.toBeInTheDocument();
  });

  it('affiche « Tous les contextes » quand aucun persona n’est actif', () => {
    afficher();

    expect(screen.getByText('Tous les contextes')).toBeInTheDocument();
  });

  it('affiche le rôle du persona actif', () => {
    brancher({ activePersonaId: 1 });

    afficher();

    expect(screen.getByText('Dirigeant')).toBeInTheDocument();
  });

  it('nomme un persona sans rôle par son identifiant', () => {
    afficher();

    ouvrirPersonas();

    expect(screen.getByText('Persona #2')).toBeInTheDocument();
  });

  it('bascule sur le persona choisi', () => {
    afficher();
    ouvrirPersonas();

    fireEvent.click(screen.getByText('Dirigeant'));

    expect(personaStore.setActivePersona).toHaveBeenCalledWith(1);
  });

  it('revient à tous les contextes', () => {
    brancher({ activePersonaId: 1 });
    afficher();
    ouvrirPersonas();

    fireEvent.click(screen.getByText('Tous les contextes'));

    expect(personaStore.setActivePersona).toHaveBeenCalledWith(null);
  });

  it('referme le sélecteur à la touche Échap', () => {
    afficher();
    ouvrirPersonas();
    expect(screen.getByText(/Contexte d.affichage/)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText(/Contexte d.affichage/)).not.toBeInTheDocument();
  });
});

describe('En-tête — navigation mobile', () => {
  it('remonte l’ouverture du menu latéral', () => {
    const onMenuClick = vi.fn();
    afficher({ onMenuClick });

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le menu/ }));

    expect(onMenuClick).toHaveBeenCalled();
  });

  it('reste utilisable sans gestionnaire de menu', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le menu/ }));

    expect(screen.getByText('Module PME')).toBeInTheDocument();
  });
});
