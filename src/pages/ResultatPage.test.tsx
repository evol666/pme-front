import '@testing-library/jest-dom';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type { AnalysisStatus } from '@/api/analyses';
import ResultatPage from './ResultatPage';

/**
 * Tests du livrable d'analyse : garde sur le job, rendu structuré ou brut, et
 * export PDF/DOCX.
 *
 * Le backend renvoie la proposition sous forme de chaîne JSON. Le parsing est
 * défensif — chaîne non JSON, tableau, JSON invalide — et chaque cas doit
 * retomber sur le rendu brut plutôt que casser la page.
 */

const navMock = vi.hoisted(() => vi.fn());

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navMock,
}));
vi.mock('@/api/analyses', () => ({ useAnalysisStatus: vi.fn() }));
vi.mock('@/api/export', () => ({ useExportDocument: vi.fn() }));

import { useAnalysisStatus } from '@/api/analyses';
import { useExportDocument } from '@/api/export';

const analyse = (overrides: Partial<AnalysisStatus> = {}): AnalysisStatus =>
  ({
    job_id: 'job-123',
    status: 'completed',
    proposal: null,
    diagnostic: 'Diagnostic textuel de la situation.',
    recommended_tools: [],
    workflows: [],
    company: { name: 'Translog' },
    detected_business: { label: 'Transport routier' },
    ...overrides,
  }) as AnalysisStatus;

const propositionStructuree = JSON.stringify({
  executiveSummary: 'Trois leviers immédiats.',
  contextAnalysis: 'Le BFR se dégrade depuis deux trimestres.',
  recommendations: [
    { titre: 'Relancer les impayés', description: 'Plus de 30 jours.', priorite: 'haute' },
    { name: 'Renégocier les délais', rationale: 'Auprès des fournisseurs.', priority: 'medium' },
    { label: 'Suivre le DSO', summary: 'Mensuellement.', severity: 'basse' },
  ],
  actionPlan: [
    { titre: 'Cartographier les encours', description: 'Par client.', duree: '1 semaine' },
    { name: 'Mettre en place les relances', summary: 'Automatiques.', duration: '2 semaines' },
  ],
  expectedBenefits: '15 jours de DSO gagnés.',
  nextSteps: 'Valider le plan en comité.',
});

function brancher(o: Record<string, unknown> = {}) {
  const exportMutation = {
    mutate: vi.fn(),
    isPending: (o.exportPending as boolean) ?? false,
    isError: (o.exportError as boolean) ?? false,
    error: (o.exportErrorValue as unknown) ?? null,
  };
  vi.mocked(useAnalysisStatus).mockReturnValue({
    data: 'data' in o ? o.data : analyse(),
    isLoading: (o.isLoading as boolean) ?? false,
    isError: (o.isError as boolean) ?? false,
    error: (o.error as unknown) ?? null,
  } as never);
  vi.mocked(useExportDocument).mockReturnValue(exportMutation as never);
  return { exportMutation };
}

const afficher = (route = '/resultat?jobId=job-123') =>
  renderWithProviders(<ResultatPage />, { initialEntries: [route] });

beforeEach(() => {
  vi.clearAllMocks();
  brancher();
});

describe('Livrable — garde sur le job', () => {
  it('refuse une URL sans identifiant de job', () => {
    afficher('/resultat');

    expect(screen.getByText('Job manquant')).toBeInTheDocument();
    expect(useAnalysisStatus).toHaveBeenCalledWith(null);
  });

  it('renvoie vers la liste des analyses', () => {
    afficher('/resultat');

    fireEvent.click(screen.getByRole('button', { name: 'Retour aux analyses' }));

    expect(navMock).toHaveBeenCalledWith('/analyses');
  });

  it('signale le chargement', () => {
    brancher({ data: undefined, isLoading: true });

    afficher();

    expect(screen.getByText('Chargement du résultat…')).toBeInTheDocument();
  });

  it('remonte le message métier d’une erreur backend', () => {
    brancher({
      data: undefined,
      isError: true,
      error: { response: { data: { error: { message: 'Analyse expirée' } } } },
    });

    afficher();

    expect(screen.getByText('Résultat indisponible')).toBeInTheDocument();
    expect(screen.getByText('Analyse expirée')).toBeInTheDocument();
  });

  it('retombe sur le message d’exception quand le backend est muet', () => {
    brancher({ data: undefined, isError: true, error: new Error('Network Error') });

    afficher();

    expect(screen.getByText('Network Error')).toBeInTheDocument();
  });
});

describe('Livrable — en-tête', () => {
  it('titre le livrable au nom de l’entreprise et à son métier', () => {
    afficher();

    expect(screen.getByRole('heading', { name: 'Translog' })).toBeInTheDocument();
    expect(screen.getByText('Transport routier')).toBeInTheDocument();
    expect(screen.getByText('Livrable')).toBeInTheDocument();
  });

  it('retombe sur l’identifiant de job quand l’entreprise est inconnue', () => {
    brancher({ data: analyse({ company: null, detected_business: null }) });

    afficher();

    expect(screen.getByRole('heading', { name: 'job-123' })).toBeInTheDocument();
  });

  it('ignore une entreprise sans nom exploitable', () => {
    brancher({ data: analyse({ company: { name: '' }, detected_business: { label: 42 } }) });

    afficher();

    // Un nom vide ou un libellé non textuel ne doit pas s'afficher tel quel.
    expect(screen.getByRole('heading', { name: 'job-123' })).toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('parle d’analyse tant qu’elle n’est pas terminée', () => {
    brancher({ data: analyse({ status: 'running' }) });

    afficher();

    expect(screen.getByText('Analyse')).toBeInTheDocument();
    // Rien à exporter tant que l'analyse tourne.
    expect(screen.getByRole('button', { name: /PDF/ })).toBeDisabled();
  });
});

describe('Livrable — rendu structuré', () => {
  const ouvrirStructure = () => {
    brancher({ data: analyse({ proposal: propositionStructuree }) });
    afficher();
  };

  it('affiche les six sections du livrable', () => {
    ouvrirStructure();

    expect(screen.getByText('Trois leviers immédiats.')).toBeInTheDocument();
    expect(screen.getByText(/Le BFR se dégrade/)).toBeInTheDocument();
    expect(screen.getByText('Recommandations')).toBeInTheDocument();
    expect(screen.getByText("Plan d'action")).toBeInTheDocument();
    expect(screen.getByText('15 jours de DSO gagnés.')).toBeInTheDocument();
    expect(screen.getByText('Valider le plan en comité.')).toBeInTheDocument();
  });

  // Trois cas de même forme : même montage, puis vérification que des libellés
  // attendus sont rendus. Les intitulés sont conservés tels quels — ce sont eux
  // qui portent l'intention de chaque cas.
  it.each([
    [
      // `name`/`rationale`/`priority` sont acceptés au même titre que
      // `titre`/`description`/`priorite`.
      'accepte les variantes de nommage du backend',
      ['Renégocier les délais', 'Auprès des fournisseurs.', 'Suivre le DSO'],
    ],
    ['distingue les trois niveaux de priorité', ['haute', 'medium', 'basse']],
    [
      'numérote les étapes du plan et affiche leur durée',
      ['1', '1 semaine', '2 semaines'],
    ],
  ])('%s', (_intitule, libelles) => {
    ouvrirStructure();

    for (const libelle of libelles) {
      expect(screen.getByText(libelle)).toBeInTheDocument();
    }
  });

  it('numérote les entrées sans titre', () => {
    brancher({
      data: analyse({
        proposal: JSON.stringify({
          recommendations: [{ description: 'sans titre' }],
          actionPlan: [{ description: 'étape sans titre' }],
        }),
      }),
    });

    afficher();

    expect(screen.getByText('Recommandation 1')).toBeInTheDocument();
    expect(screen.getByText('Étape 1')).toBeInTheDocument();
  });

  it('masque une durée non renseignée', () => {
    brancher({
      data: analyse({
        proposal: JSON.stringify({ actionPlan: [{ titre: 'Sans durée' }] }),
      }),
    });

    afficher();

    // Le repli « — » ne doit pas s'afficher comme une durée réelle.
    expect(screen.getByText('Sans durée')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});

describe('Livrable — rendu brut', () => {
  it('verse le texte libre dans le résumé quand ce n’est pas du JSON', () => {
    brancher({ data: analyse({ proposal: 'Proposition rédigée en texte libre.' }) });

    afficher();

    expect(screen.getByText('Proposition rédigée en texte libre.')).toBeInTheDocument();
    expect(screen.getByText(/Diagnostic textuel/)).toBeInTheDocument();
  });

  it('ne perd pas la proposition quand le JSON est invalide', () => {
    brancher({ data: analyse({ proposal: '{ceci ne parse pas' }) });

    afficher();

    // Le parsing échoue silencieusement : le texte reste affiché tel quel.
    expect(screen.getByText('{ceci ne parse pas')).toBeInTheDocument();
  });

  it('ne perd pas la proposition quand le JSON est un tableau', () => {
    brancher({ data: analyse({ proposal: '[1,2,3]' }) });

    afficher();

    expect(screen.getByText('[1,2,3]')).toBeInTheDocument();
  });

  it('affiche les sections brutes quand il n’y a rien à structurer', () => {
    brancher({
      data: analyse({ proposal: null, diagnostic: null }),
    });

    afficher();

    expect(screen.getByText('Proposition')).toBeInTheDocument();
    expect(screen.getByText('Diagnostic')).toBeInTheDocument();
  });

  it('reprend les outils recommandés du statut en l’absence de structure', () => {
    brancher({
      data: analyse({
        proposal: null,
        recommended_tools: [{ titre: 'Outil de relance', description: 'SaaS' }],
        workflows: [{ titre: 'Workflow relance', duree: '3 jours' }],
      }),
    });

    afficher();

    expect(screen.getByText('Outil de relance')).toBeInTheDocument();
    expect(screen.getByText('Workflow relance')).toBeInTheDocument();
  });
});

describe('Livrable — export', () => {
  it('exporte en PDF avec le contexte de l’entreprise', () => {
    const { exportMutation } = brancher({
      data: analyse({ proposal: propositionStructuree }),
    });
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /PDF/ }));

    expect(exportMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'pdf',
        request: expect.objectContaining({
          meta: { company_name: 'Translog', metier_label: 'Transport routier' },
        }),
      }),
    );
  });

  it('exporte en DOCX', () => {
    const { exportMutation } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /DOCX/ }));

    expect(exportMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'docx' }),
    );
  });

  it('bloque les deux boutons pendant l’export', () => {
    brancher({ exportPending: true });

    afficher();

    expect(screen.getByRole('button', { name: /PDF/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /DOCX/ })).toBeDisabled();
  });

  it('affiche l’échec de l’export sans masquer le livrable', () => {
    brancher({
      exportError: true,
      exportErrorValue: {
        response: { data: { error: { message: 'Générateur indisponible' } } },
      },
    });

    afficher();

    expect(screen.getByText(/Générateur indisponible/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Translog' })).toBeInTheDocument();
  });

  it('retombe sur le message d’exception de l’export', () => {
    brancher({ exportError: true, exportErrorValue: new Error('timeout') });

    afficher();

    expect(screen.getByText(/timeout/)).toBeInTheDocument();
  });
});
