import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntrepriseSearchResult } from '@/api/entreprises';
import { WizardAjoutEntreprise } from './WizardAjoutEntreprise';

/**
 * Tests de l'assistant d'ajout d'entreprise au portefeuille : recherche
 * temporisée, fiche enrichie, choix de la relation et envoi.
 *
 * La charge utile envoyée au backend combine le résultat de recherche et la
 * fiche enrichie : c'est le point le plus facile à casser, il est vérifié
 * champ par champ, y compris quand l'enrichissement n'a rien renvoyé.
 */

const entreprises = vi.hoisted(() => ({
  useEntreprise: vi.fn(),
  useEntrepriseSearch: vi.fn(),
}));
const portefeuille = vi.hoisted(() => ({
  useAddEntreprise: vi.fn(),
  RELATION_TYPES: [
    { value: 'client', label: 'Client', color: 'emerald' },
    { value: 'prospect', label: 'Prospect', color: 'blue' },
    { value: 'partenaire', label: 'Partenaire', color: 'violet' },
    { value: 'concurrent', label: 'Concurrent', color: 'amber' },
    { value: 'fournisseur', label: 'Fournisseur', color: 'orange' },
  ],
}));

vi.mock('@/api/entreprises', () => entreprises);
vi.mock('@/api/portefeuille', () => portefeuille);

const resultat = (
  overrides: Partial<EntrepriseSearchResult> = {},
): EntrepriseSearchResult => ({
  siren: '414056309',
  nomAffichage: 'Athanor SAS',
  raisonSociale: 'ATHANOR',
  codeNaf: '62.01Z',
  etat: 'A',
  categorie: 'PME',
  trancheEffectif: '12',
  dateCreation: '2010-03-01',
  ...overrides,
});

const enrichie = (overrides: Record<string, unknown> = {}) => ({
  identite: {
    raison_sociale: 'ATHANOR SAS',
    statut: 'actif',
    code_naf: '62.01Z',
    libelle_naf: 'Programmation informatique',
    ville: 'Lyon',
    adresse: '12 rue des Fabriques',
    code_postal: '69001',
    categorie: 'PME',
    effectif_tranche: '12',
    risque_sectoriel: 'faible',
    convention_collective: 'Syntec',
  },
  scoring: { score_global: 78, severity: 'faible' },
  synthese: {
    points_cles: {
      anciennete_ans: 16,
      signaux_bodacc_risque: 0,
      signaux_bodacc_croissance: 2,
    },
  },
  ...overrides,
});

function brancher(o: Record<string, unknown> = {}) {
  const ajout = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: (o.pending as boolean) ?? false,
  };
  entreprises.useEntrepriseSearch.mockReturnValue({
    data: { results: 'results' in o ? o.results : [resultat()], total: (o.total as number) ?? 1 },
    isFetching: (o.fetching as boolean) ?? false,
  });
  entreprises.useEntreprise.mockReturnValue({
    data: 'enriched' in o ? o.enriched : enrichie(),
    isLoading: (o.enrichLoading as boolean) ?? false,
  });
  portefeuille.useAddEntreprise.mockReturnValue(ajout);
  return { ajout };
}

const afficher = () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(<WizardAjoutEntreprise onClose={onClose} onSuccess={onSuccess} />);
  return { onClose, onSuccess };
};

/** Saisit une recherche et laisse passer la temporisation de 300 ms. */
const rechercher = (terme: string) => {
  fireEvent.change(screen.getByLabelText(/SIREN ou nom de l'entreprise/), {
    target: { value: terme },
  });
  act(() => {
    vi.advanceTimersByTime(300);
  });
};

/** Parcourt les deux premières étapes jusqu'au choix de la relation. */
const allerJusquALaRelation = () => {
  rechercher('athanor');
  fireEvent.click(screen.getByText('Athanor SAS'));
  fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  brancher();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Assistant d’ajout — fermeture', () => {
  it('se ferme au bouton de fermeture', () => {
    const { onClose } = afficher();

    fireEvent.click(document.querySelectorAll('button')[0]);

    expect(onClose).toHaveBeenCalled();
  });

  it('se ferme au clic sur le fond', () => {
    const { onClose } = afficher();

    fireEvent.click(document.querySelector('[aria-hidden="true"]') as HTMLElement);

    expect(onClose).toHaveBeenCalled();
  });

  it('se ferme à la touche Échap', () => {
    const { onClose } = afficher();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});

describe('Assistant d’ajout — recherche', () => {
  it('ouvre sur l’étape de recherche', () => {
    afficher();

    expect(screen.getByText(/Étape 1 sur 3 — Recherche/)).toBeInTheDocument();
    // Sans entreprise choisie, on ne peut pas avancer.
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });

  it('ne lance la recherche qu’après la temporisation', () => {
    afficher();

    fireEvent.change(screen.getByLabelText(/SIREN ou nom de l'entreprise/), {
      target: { value: 'ath' },
    });
    // Avant 300 ms, la requête porte encore sur la saisie précédente.
    expect(entreprises.useEntrepriseSearch).toHaveBeenLastCalledWith('', 0, 12);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(entreprises.useEntrepriseSearch).toHaveBeenLastCalledWith('ath', 0, 12);
  });

  it('liste les résultats avec leur SIREN et leur code NAF', () => {
    afficher();

    rechercher('athanor');

    expect(screen.getByText('Athanor SAS')).toBeInTheDocument();
    expect(screen.getByText(/414056309/)).toBeInTheDocument();
    expect(screen.getByText(/62.01Z/)).toBeInTheDocument();
  });

  it('signale une entreprise cessée', () => {
    brancher({ results: [resultat({ etat: 'C' })] });
    afficher();

    rechercher('athanor');

    expect(screen.getByText('cessée')).toBeInTheDocument();
  });

  it('invite à affiner quand tous les résultats ne tiennent pas', () => {
    brancher({ total: 240 });
    afficher();

    rechercher('sas');

    expect(screen.getByText(/240 résultats — affinez/)).toBeInTheDocument();
  });

  it('annonce l’absence de résultat au-delà de deux caractères', () => {
    brancher({ results: [], total: 0 });
    afficher();

    rechercher('zzz');

    expect(screen.getByText('Aucune entreprise trouvée')).toBeInTheDocument();
  });

  it('n’annonce rien tant que la saisie est trop courte', () => {
    brancher({ results: [], total: 0 });
    afficher();

    rechercher('z');

    expect(screen.queryByText('Aucune entreprise trouvée')).not.toBeInTheDocument();
  });
});

describe('Assistant d’ajout — fiche enrichie', () => {
  const ouvrirLaFiche = () => {
    afficher();
    rechercher('athanor');
    fireEvent.click(screen.getByText('Athanor SAS'));
  };

  it('passe à la confirmation au choix d’une entreprise', () => {
    ouvrirLaFiche();

    expect(screen.getByText(/Étape 2 sur 3 — Confirmation/)).toBeInTheDocument();
  });

  it('restitue identité, score et points clés', () => {
    ouvrirLaFiche();

    expect(screen.getByText('ATHANOR SAS')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(screen.getByText('16 ans')).toBeInTheDocument();
  });

  it('affiche l’adresse complète quand elle est connue', () => {
    ouvrirLaFiche();

    expect(
      screen.getByText('12 rue des Fabriques, 69001, Lyon'),
    ).toBeInTheDocument();
  });

  it('marque une entreprise cessée', () => {
    brancher({
      enriched: enrichie({
        identite: { ...enrichie().identite, statut: 'cesse' },
      }),
    });
    ouvrirLaFiche();

    expect(screen.getByText('Cessé')).toBeInTheDocument();
  });

  it('signale l’enrichissement en cours', () => {
    brancher({ enrichLoading: true });
    ouvrirLaFiche();

    expect(screen.getByText('Enrichissement en cours…')).toBeInTheDocument();
  });

  it('retombe sur le nom de recherche quand l’enrichissement est vide', () => {
    brancher({ enriched: null });
    ouvrirLaFiche();

    // Sans fiche enrichie, l'écran reste lisible avec les seules données de recherche.
    expect(screen.getByText('Athanor SAS')).toBeInTheDocument();
    expect(screen.queryByText('78')).not.toBeInTheDocument();
  });

  it('n’affiche que les points clés renseignés', () => {
    brancher({
      enriched: enrichie({
        identite: { raison_sociale: 'ATHANOR SAS', ville: 'Lyon' },
        scoring: {},
        synthese: {},
      }),
    });
    ouvrirLaFiche();

    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(screen.queryByText('Ancienneté')).not.toBeInTheDocument();
  });

  it('revient à la recherche', () => {
    ouvrirLaFiche();

    fireEvent.click(screen.getByRole('button', { name: /Précédent/ }));

    expect(screen.getByText(/Étape 1 sur 3 — Recherche/)).toBeInTheDocument();
  });
});

describe('Assistant d’ajout — relation et envoi', () => {
  it('propose les cinq types de relation, prospect par défaut', () => {
    afficher();
    allerJusquALaRelation();

    expect(screen.getByText(/Étape 3 sur 3 — Relation/)).toBeInTheDocument();
    for (const libelle of ['Client', 'Prospect', 'Partenaire', 'Concurrent', 'Fournisseur']) {
      expect(screen.getByRole('button', { name: new RegExp(libelle) })).toBeInTheDocument();
    }
  });

  it('envoie la fiche complète au portefeuille', async () => {
    const { ajout } = brancher();
    const { onSuccess } = afficher();
    allerJusquALaRelation();

    fireEvent.click(screen.getByRole('button', { name: /Client/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '' }), {
      target: { value: 'Rencontré au salon' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au portefeuille/ }));

    await waitFor(() =>
      expect(ajout.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          siren: '414056309',
          label: 'Athanor SAS',
          kind: 'client',
          notes: 'Rencontré au salon',
          libelleNaf: 'Programmation informatique',
          ville: 'Lyon',
          score: 78,
          severity: 'faible',
          statut: 'actif',
        }),
      ),
    );
    expect(onSuccess).toHaveBeenCalledWith('414056309');
  });

  it('omet des notes vides plutôt que d’envoyer une chaîne blanche', async () => {
    const { ajout } = brancher();
    afficher();
    allerJusquALaRelation();

    fireEvent.change(screen.getByRole('textbox', { name: '' }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au portefeuille/ }));

    await waitFor(() => expect(ajout.mutateAsync).toHaveBeenCalled());
    expect(ajout.mutateAsync.mock.calls[0][0]).toMatchObject({ notes: undefined });
  });

  it('envoie des champs nuls quand l’enrichissement n’a rien renvoyé', async () => {
    const { ajout } = brancher({ enriched: null });
    afficher();
    allerJusquALaRelation();

    fireEvent.click(screen.getByRole('button', { name: /Ajouter au portefeuille/ }));

    await waitFor(() => expect(ajout.mutateAsync).toHaveBeenCalled());
    expect(ajout.mutateAsync.mock.calls[0][0]).toMatchObject({
      libelleNaf: null,
      ville: null,
      score: null,
      severity: null,
    });
  });

  it('bloque le bouton pendant l’ajout', () => {
    brancher({ pending: true });
    afficher();
    allerJusquALaRelation();

    expect(screen.getByRole('button', { name: /Ajout en cours…/ })).toBeDisabled();
  });
});
