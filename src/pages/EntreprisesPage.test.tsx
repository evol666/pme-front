import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import EntreprisesPage from './EntreprisesPage';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  const { mockUseNavigate } = await import('@athanor/test-utils/mocks/router');
  return { ...actual, ...mockUseNavigate(mockNavigate) };
});

const { usePortefeuille, useRemoveEntreprise, useAddEntreprise } = vi.hoisted(() => ({
  usePortefeuille: vi.fn(),
  useRemoveEntreprise: vi.fn(),
  useAddEntreprise: vi.fn(),
}));

vi.mock('@/api/portefeuille', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/portefeuille')>()),
  usePortefeuille,
  useRemoveEntreprise,
  useAddEntreprise,
}));

// Le wizard et l'import CSV ont leurs propres écrans : on les réduit à un marqueur.
vi.mock('@/components/entreprise/WizardAjoutEntreprise', () => ({
  WizardAjoutEntreprise: () => <div>assistant ajout</div>,
}));
vi.mock('@/components/entreprise/ImportCsvModal', () => ({
  ImportCsvModal: () => <div>import CSV</div>,
}));

const makeEntreprise = (overrides = {}) => ({
  id: 1,
  siren: '123456789',
  label: 'Boulangerie Dupont',
  kind: 'client',
  notes: null,
  codeNaf: '1071C',
  libelleNaf: 'Boulangerie',
  ville: 'Lyon',
  score: 72,
  severity: 'faible',
  statut: 'active',
  effectifTranche: '3 à 5',
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
  ...overrides,
});

const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });

function setPortefeuille(data: unknown[], extra: Record<string, unknown> = {}) {
  usePortefeuille.mockReturnValue({
    data,
    isLoading: false,
    isSeeding: false,
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setPortefeuille([makeEntreprise()]);
  useRemoveEntreprise.mockReturnValue(mutation());
  useAddEntreprise.mockReturnValue(mutation());
});

const searchBox = () => screen.getByPlaceholderText('Filtrer par nom, SIREN ou ville…');

describe('EntreprisesPage', () => {
  it('affiche le portefeuille', () => {
    renderWithProviders(<EntreprisesPage />);

    expect(screen.getByText('Entreprises')).toBeInTheDocument();
    expect(screen.getByText('Boulangerie Dupont')).toBeInTheDocument();
    expect(screen.getByText('123456789')).toBeInTheDocument();
  });

  it('affiche le score de l’entreprise', () => {
    renderWithProviders(<EntreprisesPage />);

    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('annonce un portefeuille vide', () => {
    setPortefeuille([]);

    renderWithProviders(<EntreprisesPage />);

    expect(screen.getByText('Portefeuille vide')).toBeInTheDocument();
  });

  it('distingue le cas « aucun résultat » du portefeuille vide', () => {
    renderWithProviders(<EntreprisesPage />);

    fireEvent.change(searchBox(), { target: { value: 'zzzz' } });

    expect(screen.getByText('Aucune entreprise ne correspond')).toBeInTheDocument();
  });

  it('filtre par raison sociale', () => {
    setPortefeuille([
      makeEntreprise(),
      makeEntreprise({ id: 2, siren: '987654321', label: 'Garage Martin' }),
    ]);
    renderWithProviders(<EntreprisesPage />);

    fireEvent.change(searchBox(), { target: { value: 'garage' } });

    expect(screen.getByText('Garage Martin')).toBeInTheDocument();
    expect(screen.queryByText('Boulangerie Dupont')).toBeNull();
  });

  it('filtre par SIREN', () => {
    setPortefeuille([
      makeEntreprise(),
      makeEntreprise({ id: 2, siren: '987654321', label: 'Garage Martin' }),
    ]);
    renderWithProviders(<EntreprisesPage />);

    fireEvent.change(searchBox(), { target: { value: '9876' } });

    expect(screen.getByText('Garage Martin')).toBeInTheDocument();
  });

  it('filtre par ville', () => {
    setPortefeuille([
      makeEntreprise(),
      makeEntreprise({ id: 2, siren: '987654321', label: 'Garage Martin', ville: 'Nantes' }),
    ]);
    renderWithProviders(<EntreprisesPage />);

    fireEvent.change(searchBox(), { target: { value: 'nantes' } });

    expect(screen.getByText('Garage Martin')).toBeInTheDocument();
  });

  it('signale une entreprise cessée', () => {
    setPortefeuille([makeEntreprise({ statut: 'cessee' })]);

    renderWithProviders(<EntreprisesPage />);

    expect(screen.getByText('Cessée')).toBeInTheDocument();
  });

  it('ouvre la fiche entreprise au clic', () => {
    renderWithProviders(<EntreprisesPage />);

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir la fiche/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/entreprises/123456789');
  });

  it("ouvre l'assistant d'ajout", async () => {
    renderWithProviders(<EntreprisesPage />);

    const boutons = screen.getAllByRole('button');
    for (const b of boutons) {
      if (/ajouter|nouvelle|entreprise/i.test(b.textContent ?? '')) {
        fireEvent.click(b);
        break;
      }
    }

    expect(await screen.findByText('assistant ajout')).toBeInTheDocument();
  });

  it("ouvre l'import CSV", async () => {
    renderWithProviders(<EntreprisesPage />);

    const boutons = screen.getAllByRole('button');
    for (const b of boutons) {
      if (/import/i.test(b.textContent ?? '')) {
        fireEvent.click(b);
        break;
      }
    }

    expect(await screen.findByText('import CSV')).toBeInTheDocument();
  });

  it('affiche un état de chargement', () => {
    usePortefeuille.mockReturnValue({ data: [], isLoading: true, isSeeding: false });

    renderWithProviders(<EntreprisesPage />);

    expect(screen.queryByText('Portefeuille vide')).toBeNull();
  });
});
