import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportReport } from '@/api/portefeuilleImport';
import { ImportCsvModal } from './ImportCsvModal';

/**
 * Tests de l'import CSV du portefeuille : sélection du fichier (clic ou
 * glisser-déposer), refus des formats non CSV, et rapport d'import.
 *
 * Le rapport est le seul retour que l'utilisateur obtient sur un import de
 * masse : ses trois compteurs et leurs accords sont vérifiés séparément.
 */

const portefeuille = vi.hoisted(() => ({
  useImportCsv: vi.fn(),
  downloadTemplate: vi.fn(),
}));

vi.mock('@/api/portefeuilleImport', () => portefeuille);

const rapport = (overrides: Partial<ImportReport> = {}): ImportReport => ({
  imported: 3,
  skipped: 1,
  importedSirens: ['414056309', '552032534', '542101803'],
  skippedSirens: ['111111111'],
  errors: [],
  ...overrides,
});

function brancher(o: { report?: ImportReport; pending?: boolean } = {}) {
  const mutation = {
    mutateAsync: vi.fn().mockResolvedValue(o.report ?? rapport()),
    isPending: o.pending ?? false,
  };
  portefeuille.useImportCsv.mockReturnValue(mutation);
  return mutation;
}

const afficher = () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(<ImportCsvModal onClose={onClose} onSuccess={onSuccess} />);
  return { onClose, onSuccess };
};

const csv = (nom = 'portefeuille.csv') =>
  new File(['siren,kind,notes'], nom, { type: 'text/csv' });

/** Dépose un fichier via le champ caché, comme le ferait un clic « parcourir ». */
const choisirFichier = (fichier: File) => {
  const champ = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(champ, { target: { files: [fichier] } });
};

const zoneDepot = () =>
  screen.getByRole('button', {
    name: /Déposer un fichier CSV ou cliquer pour parcourir/,
  });

beforeEach(() => {
  vi.clearAllMocks();
  brancher();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Import CSV — fermeture', () => {
  it('se ferme au bouton Annuler', () => {
    const { onClose } = afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

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

  it('ignore les autres touches', () => {
    const { onClose } = afficher();

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Import CSV — choix du fichier', () => {
  it('propose le modèle de fichier', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Télécharger/ }));

    expect(portefeuille.downloadTemplate).toHaveBeenCalled();
  });

  it('affiche le nom et la taille du fichier retenu', () => {
    afficher();

    choisirFichier(csv());

    expect(screen.getByText('portefeuille.csv')).toBeInTheDocument();
    expect(screen.getByText(/Ko — cliquer pour changer/)).toBeInTheDocument();
  });

  it('accepte un fichier déposé', () => {
    afficher();

    fireEvent.drop(zoneDepot(), { dataTransfer: { files: [csv('depose.csv')] } });

    expect(screen.getByText('depose.csv')).toBeInTheDocument();
  });

  it('ignore un dépôt sans fichier', () => {
    afficher();

    fireEvent.drop(zoneDepot(), { dataTransfer: { files: [] } });

    expect(screen.getByText('Déposer le fichier CSV ici')).toBeInTheDocument();
  });

  it('refuse un fichier qui n’est pas un CSV', () => {
    const alerte = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    afficher();

    choisirFichier(new File(['x'], 'photo.png', { type: 'image/png' }));

    expect(alerte).toHaveBeenCalledWith('Le fichier doit être au format CSV.');
    expect(screen.getByText('Déposer le fichier CSV ici')).toBeInTheDocument();
  });

  it('accepte un .csv même sans type MIME déclaré', () => {
    afficher();

    // Certains navigateurs ne renseignent pas `type` : l'extension fait foi.
    choisirFichier(new File(['x'], 'sans-type.csv', { type: '' }));

    expect(screen.getByText('sans-type.csv')).toBeInTheDocument();
  });

  it('marque la zone pendant le survol d’un glisser', () => {
    afficher();
    const zone = zoneDepot();

    fireEvent.dragOver(zone);
    expect(zone.className).toContain('border-primary');

    fireEvent.dragLeave(zone);
    expect(zone.className).not.toContain('bg-primary/5');
  });
});

describe('Import CSV — envoi', () => {
  it('n’envoie rien tant qu’aucun fichier n’est choisi', () => {
    const mutation = brancher();
    afficher();

    expect(screen.getByRole('button', { name: /Importer/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Importer/ }));

    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('envoie le fichier choisi', async () => {
    const mutation = brancher();
    const { onSuccess } = afficher();
    choisirFichier(csv());

    fireEvent.click(screen.getByRole('button', { name: /Importer/ }));

    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ imported: 3 }));
  });

  it('ne prévient le parent que si quelque chose a été importé', async () => {
    brancher({ report: rapport({ imported: 0, importedSirens: [] }) });
    const { onSuccess } = afficher();
    choisirFichier(csv());

    fireEvent.click(screen.getByRole('button', { name: /Importer/ }));

    // Un import intégralement en échec ne doit pas déclencher de rafraîchissement.
    expect(await screen.findByText('Fermer')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('bloque le bouton pendant l’import', () => {
    brancher({ pending: true });
    afficher();
    choisirFichier(csv());

    expect(screen.getByRole('button', { name: /Import en cours…/ })).toBeDisabled();
  });
});

describe('Import CSV — rapport', () => {
  const importer = async (report: ImportReport) => {
    brancher({ report });
    const contexte = afficher();
    choisirFichier(csv());
    fireEvent.click(screen.getByRole('button', { name: /Importer/ }));
    await screen.findByText('Fermer');
    return contexte;
  };

  it('résume les trois compteurs et masque la zone de dépôt', async () => {
    await importer(rapport({ errors: [{ line: 4, message: 'SIREN invalide' }] }));

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Déposer le fichier CSV ici')).not.toBeInTheDocument();
  });

  it('accorde le message de succès au pluriel', async () => {
    await importer(rapport({ imported: 3 }));

    expect(screen.getByText(/3 entreprises/)).toBeInTheDocument();
  });

  it('accorde le message de succès au singulier', async () => {
    await importer(rapport({ imported: 1, skipped: 0, skippedSirens: [] }));

    expect(screen.getByText(/1 entreprise$/)).toBeInTheDocument();
  });

  it('liste les doublons ignorés', async () => {
    await importer(
      rapport({ skipped: 2, skippedSirens: ['111111111', '222222222'] }),
    );

    expect(screen.getByText(/2 doublons ignorés/)).toBeInTheDocument();
    expect(screen.getByText(/111111111, 222222222/)).toBeInTheDocument();
  });

  it('tronque la liste des doublons au-delà de cinq', async () => {
    await importer(
      rapport({
        skipped: 7,
        skippedSirens: ['1', '2', '3', '4', '5', '6', '7'],
      }),
    );

    expect(screen.getByText('1, 2, 3, 4, 5…')).toBeInTheDocument();
  });

  it('détaille les erreurs ligne par ligne', async () => {
    await importer(
      rapport({
        imported: 0,
        skipped: 0,
        importedSirens: [],
        skippedSirens: [],
        errors: [
          { line: 2, message: 'SIREN invalide' },
          { line: 5, message: 'kind inconnu' },
        ],
      }),
    );

    expect(screen.getByText(/2 erreurs/)).toBeInTheDocument();
    expect(screen.getByText('Ligne 2')).toBeInTheDocument();
    expect(screen.getByText(/kind inconnu/)).toBeInTheDocument();
  });

  it('annonce le reste des erreurs au-delà de cinq', async () => {
    await importer(
      rapport({
        errors: Array.from({ length: 8 }, (_, i) => ({
          line: i + 1,
          message: 'ligne invalide',
        })),
      }),
    );

    expect(screen.getByText(/…et 3 autres/)).toBeInTheDocument();
  });

  it('masque les blocs succès, doublons et erreurs quand ils sont vides', async () => {
    await importer(
      rapport({ imported: 0, skipped: 0, importedSirens: [], skippedSirens: [] }),
    );

    expect(screen.queryByText(/ajoutée/)).not.toBeInTheDocument();
    expect(screen.queryByText(/doublon/)).not.toBeInTheDocument();
    expect(screen.queryByText(/erreur/)).not.toBeInTheDocument();
  });

  it('se ferme depuis le rapport', async () => {
    const { onClose } = await importer(rapport());

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(onClose).toHaveBeenCalled();
  });
});
