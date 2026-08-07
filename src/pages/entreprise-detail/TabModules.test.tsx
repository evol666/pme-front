import '@testing-library/jest-dom';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type { PmeMetierModulesDTO } from '@/api/metiers';
import { TabModules } from './TabModules';

/**
 * Tests de l'onglet Modules : catalogue du métier détecté, élargissement au
 * secteur, et sélection d'un module.
 *
 * Le métier interrogé est dérivé de la dernière analyse, avec un repli sur
 * « generique ». C'est la seule logique de l'onglet et elle décide de tout ce
 * qui s'affiche : elle est vérifiée sur chaque chemin.
 */

const api = vi.hoisted(() => ({
  useAnalyses: vi.fn(),
  useMetierModules: vi.fn(),
}));

vi.mock('@/api/analyses', async (o) => ({
  ...(await o<typeof import('@/api/analyses')>()),
  useAnalyses: api.useAnalyses,
}));
vi.mock('@/api/metiers', async (o) => ({
  ...(await o<typeof import('@/api/metiers')>()),
  useMetierModules: api.useMetierModules,
}));

const catalogue = (
  surcharges: Partial<PmeMetierModulesDTO> = {},
): PmeMetierModulesDTO => ({
  metier_id: 'boulangerie',
  label: 'Boulangerie artisanale',
  modules: [
    {
      id: 'marges',
      titre: 'Optimiser les marges',
      description: 'Analyse du coût matière et de la carte des prix.',
      duree: '2 h',
      categorie: 'Finance',
      icone: 'chart',
      prompt: 'Analyse les marges de [entreprise].',
      prompt_id: 'p-1',
    },
  ],
  tools: [
    {
      id: 'calculatrice',
      titre: 'Calculatrice de coût matière',
      description: 'Convertit les recettes en coût de revient.',
      duree: '10 min',
      icone: 'calc',
      prompt: '',
      prompt_id: null,
    },
  ],
  ...surcharges,
});

function brancher(o: Record<string, unknown> = {}) {
  api.useAnalyses.mockReturnValue({ data: 'analyses' in o ? o.analyses : [] });
  api.useMetierModules.mockReturnValue({
    data: 'catalogue' in o ? o.catalogue : catalogue(),
    isLoading: (o.isLoading as boolean) ?? false,
  });
}

const afficher = (props: Record<string, unknown> = {}) => {
  const goTo = vi.fn();
  renderWithProviders(
    <TabModules siren="123456789" activeModule={null} goTo={goTo} {...props} />,
  );
  return { goTo };
};

beforeEach(() => {
  vi.clearAllMocks();
  brancher();
});

describe('Onglet Modules — métier interrogé', () => {
  it('retombe sur le catalogue générique sans analyse', () => {
    afficher();

    expect(api.useMetierModules).toHaveBeenCalledWith('generique');
  });

  it('utilise le métier détecté par la dernière analyse', () => {
    brancher({ analyses: [{ job_id: 'j1', detected_business_id: 'boulangerie' }] });

    afficher();

    expect(api.useMetierModules).toHaveBeenCalledWith('boulangerie');
  });

  it('retombe sur le générique quand l’analyse n’a rien détecté', () => {
    brancher({ analyses: [{ job_id: 'j1', detected_business_id: null }] });

    afficher();

    expect(api.useMetierModules).toHaveBeenCalledWith('generique');
  });

  it('élargit au secteur choisi', () => {
    brancher({ analyses: [{ job_id: 'j1', detected_business_id: 'boulangerie' }] });
    afficher();

    fireEvent.change(screen.getByLabelText(/Secteur/i), {
      target: { value: 'restauration' },
    });

    expect(api.useMetierModules).toHaveBeenLastCalledWith('restauration');
  });

  it('revient au métier détecté', () => {
    brancher({ analyses: [{ job_id: 'j1', detected_business_id: 'boulangerie' }] });
    afficher();
    fireEvent.change(screen.getByLabelText(/Secteur/i), {
      target: { value: 'restauration' },
    });

    fireEvent.change(screen.getByLabelText(/Secteur/i), { target: { value: '' } });

    expect(api.useMetierModules).toHaveBeenLastCalledWith('boulangerie');
  });
});

describe('Onglet Modules — catalogue', () => {
  it('titre le catalogue et liste modules et outils', () => {
    afficher();

    expect(screen.getByText(/Boulangerie artisanale/)).toBeInTheDocument();
    expect(screen.getByText('Optimiser les marges')).toBeInTheDocument();
    expect(screen.getByText('Calculatrice de coût matière')).toBeInTheDocument();
  });

  it('retombe sur l’identifiant quand le catalogue n’a pas de libellé', () => {
    brancher({ catalogue: catalogue({ label: undefined as unknown as string }) });

    afficher();

    expect(screen.getByText(/generique/)).toBeInTheDocument();
  });

  it('annonce un métier sans module dédié', () => {
    brancher({ catalogue: catalogue({ modules: [] }) });

    afficher();

    expect(screen.getByText('Aucun module dédié pour ce métier.')).toBeInTheDocument();
  });

  it('masque la section outils quand il n’y en a pas', () => {
    brancher({ catalogue: catalogue({ tools: [] }) });

    afficher();

    expect(screen.queryByText('Outils réutilisables')).not.toBeInTheDocument();
  });

  it('signale le chargement du catalogue', () => {
    brancher({ catalogue: undefined, isLoading: true });

    afficher();

    expect(screen.getByText(/Chargement du catalogue modules/)).toBeInTheDocument();
  });

  it('annonce l’absence de catalogue', () => {
    brancher({ catalogue: null });

    afficher();

    expect(
      screen.getByText('Aucun catalogue disponible pour ce métier.'),
    ).toBeInTheDocument();
  });
});

describe('Onglet Modules — sélection', () => {
  it('ouvre le module cliqué', () => {
    const { goTo } = afficher();

    fireEvent.click(screen.getByText('Optimiser les marges'));

    expect(goTo).toHaveBeenCalledWith('modules', 'marges');
  });

  it('détaille le module sélectionné et son prompt', () => {
    afficher({ activeModule: 'marges' });

    // La catégorie figure sur la vignette et dans l'en-tête du détail.
    expect(screen.getAllByText('Finance')).toHaveLength(2);
    expect(screen.getAllByText(/Analyse du coût matière/).length).toBeGreaterThan(1);
  });

  it('referme le détail', () => {
    const { goTo } = afficher({ activeModule: 'marges' });

    const fermer = screen
      .getAllByRole('button')
      .find((b) => b.querySelector('svg') && !b.textContent?.trim());
    fireEvent.click(fermer as HTMLElement);

    expect(goTo).toHaveBeenCalledWith('modules', undefined);
  });

  it('ignore un module actif qui n’existe pas au catalogue', () => {
    afficher({ activeModule: 'inconnu' });

    // Le détail reste fermé : seule la vignette porte encore la catégorie.
    expect(screen.getAllByText('Finance')).toHaveLength(1);
  });
});
