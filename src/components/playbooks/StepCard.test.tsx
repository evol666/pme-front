import '@testing-library/jest-dom';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type { StepState } from '@/api/playbooks';
import StepCard from './StepCard';

/**
 * Tests d'une étape de playbook : rendu selon le statut, lien d'action
 * dérivé du type d'étape, note éditable et actions de pied de carte.
 *
 * Le lien d'action est calculé à partir du couple (type, identifiant) : c'est
 * la seule logique du composant, et une combinaison incomplète doit ne rien
 * proposer plutôt que de mener vers une page vide.
 */

const etape = (overrides: Partial<StepState> = {}): StepState => ({
  id: 'st-1',
  step_key: 'diagnostic',
  label: 'Réaliser le diagnostic initial',
  description: 'Collecter les pièces comptables des trois derniers exercices.',
  kind: 'action',
  status: 'pending',
  note: null,
  module_id: null,
  workflow_id: null,
  recommendation_action: null,
  automation_hint: null,
  required: true,
  est_duration: '2 h',
  started_at: null,
  completed_at: null,
  ...overrides,
});

const afficher = (step: StepState = etape(), props: Record<string, unknown> = {}) => {
  const onStatusChange = vi.fn();
  const onSaveNote = vi.fn();
  renderWithProviders(
    <StepCard
      step={step}
      position={2}
      onStatusChange={onStatusChange}
      onSaveNote={onSaveNote}
      {...props}
    />,
  );
  return { onStatusChange, onSaveNote };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Étape de playbook — présentation', () => {
  it('affiche le libellé, la durée et le type', () => {
    afficher();

    expect(screen.getByText('Réaliser le diagnostic initial')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText(/À faire · 2 h/)).toBeInTheDocument();
  });

  it('numérote l’étape tant qu’elle n’est pas faite', () => {
    afficher();

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('remplace le numéro par une coche une fois l’étape faite', () => {
    afficher(etape({ status: 'done' }));

    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText(/^Fait/)).toBeInTheDocument();
  });

  it('signale une étape optionnelle', () => {
    afficher(etape({ required: false }));

    expect(screen.getByText(/· optionnelle/)).toBeInTheDocument();
  });

  it('affiche la piste d’automatisation quand il y en a une', () => {
    afficher(etape({ automation_hint: 'Le copilote peut pré-remplir ce diagnostic.' }));

    expect(
      screen.getByText('Le copilote peut pré-remplir ce diagnostic.'),
    ).toBeInTheDocument();
  });

  it('omet description et piste d’automatisation quand elles sont absentes', () => {
    afficher(etape({ description: null }));

    expect(
      screen.queryByText(/Collecter les pièces comptables/),
    ).not.toBeInTheDocument();
  });

  it('reprend tel quel un type d’étape inconnu du référentiel', () => {
    afficher(etape({ kind: 'audit' as never, status: 'archive' as never }));

    expect(screen.getByText('audit')).toBeInTheDocument();
    expect(screen.getByText(/archive/)).toBeInTheDocument();
  });

  it('nomme les statuts intermédiaires', () => {
    afficher(etape({ status: 'in_progress' }));

    expect(screen.getByText(/En cours/)).toBeInTheDocument();
  });

  it('atténue une étape sautée', () => {
    afficher(etape({ status: 'skipped' }));

    expect(screen.getByText(/Ignoré/)).toBeInTheDocument();
  });
});

describe('Étape de playbook — lien d’action', () => {
  it('mène au module associé', () => {
    afficher(etape({ kind: 'module', module_id: 'compta 2024' }));

    const lien = screen.getByRole('link', { name: /Ouvrir le module/ });
    expect(lien).toHaveAttribute('href', '/documents?module=compta%202024');
  });

  it('mène au workflow associé', () => {
    afficher(etape({ kind: 'workflow', workflow_id: 'wf-7' }));

    expect(screen.getByRole('link', { name: /Lancer le workflow/ })).toHaveAttribute(
      'href',
      '/workflows?focus=wf-7',
    );
  });

  it('mène aux recommandations sans identifiant', () => {
    afficher(etape({ kind: 'recommendation' }));

    expect(
      screen.getByRole('link', { name: /Voir les recommandations/ }),
    ).toHaveAttribute('href', '/recommandations');
  });

  it('ne propose aucun lien pour un module sans identifiant', () => {
    // Une combinaison incomplète mènerait vers une page vide.
    afficher(etape({ kind: 'module', module_id: null }));

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('ne propose aucun lien pour une simple action', () => {
    afficher();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Étape de playbook — note', () => {
  it('propose d’ajouter une note quand il n’y en a pas', () => {
    afficher();

    expect(screen.getByRole('button', { name: /Ajouter une note/ })).toBeInTheDocument();
  });

  it('enregistre la note saisie', () => {
    const { onSaveNote } = afficher();

    fireEvent.click(screen.getByRole('button', { name: /Ajouter une note/ }));
    fireEvent.change(screen.getByPlaceholderText(/Notes, décisions, contexte/), {
      target: { value: 'Pièces reçues le 3 août' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSaveNote).toHaveBeenCalledWith('Pièces reçues le 3 août');
  });

  it('efface la note plutôt que d’enregistrer des espaces', () => {
    const { onSaveNote } = afficher(etape({ note: 'ancienne note' }));

    fireEvent.click(screen.getByText('ancienne note'));
    fireEvent.change(screen.getByPlaceholderText(/Notes, décisions, contexte/), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSaveNote).toHaveBeenCalledWith(null);
  });

  it('affiche la note existante et permet de la rouvrir', () => {
    afficher(etape({ note: 'Relancer le comptable' }));

    expect(screen.getByText('Relancer le comptable')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Relancer le comptable'));

    expect(screen.getByPlaceholderText(/Notes, décisions, contexte/)).toHaveValue(
      'Relancer le comptable',
    );
  });

  it('abandonne l’édition sans rien enregistrer', () => {
    const { onSaveNote } = afficher(etape({ note: 'note initiale' }));
    fireEvent.click(screen.getByText('note initiale'));

    fireEvent.change(screen.getByPlaceholderText(/Notes, décisions, contexte/), {
      target: { value: 'brouillon abandonné' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onSaveNote).not.toHaveBeenCalled();
    expect(screen.getByText('note initiale')).toBeInTheDocument();
  });
});

describe('Étape de playbook — actions', () => {
  it('propose de démarrer, sauter ou terminer une étape à faire', () => {
    const { onStatusChange } = afficher();

    fireEvent.click(screen.getByRole('button', { name: /Démarrer/ }));
    expect(onStatusChange).toHaveBeenCalledWith('in_progress');

    fireEvent.click(screen.getByRole('button', { name: /Sauter/ }));
    expect(onStatusChange).toHaveBeenCalledWith('skipped');

    fireEvent.click(screen.getByRole('button', { name: /Marquer fait/ }));
    expect(onStatusChange).toHaveBeenCalledWith('done');
  });

  it('n’offre plus de démarrer une étape déjà en cours', () => {
    afficher(etape({ status: 'in_progress' }));

    expect(screen.queryByRole('button', { name: /Démarrer/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marquer fait/ })).toBeInTheDocument();
  });

  it('ne propose que la réouverture sur une étape faite', () => {
    const { onStatusChange } = afficher(etape({ status: 'done' }));

    expect(screen.queryByRole('button', { name: /Marquer fait/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rouvrir' }));

    expect(onStatusChange).toHaveBeenCalledWith('in_progress');
  });

  it('bloque les actions pendant un enregistrement', () => {
    afficher(etape(), { saving: true });

    expect(screen.getByRole('button', { name: /Marquer fait/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sauter/ })).toBeDisabled();
  });

  it('bloque aussi la réouverture pendant un enregistrement', () => {
    afficher(etape({ status: 'done' }), { saving: true });

    expect(screen.getByRole('button', { name: 'Rouvrir' })).toBeDisabled();
  });
});
