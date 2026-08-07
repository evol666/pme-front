import { describe, expect, it, vi } from 'vitest';
import type { Identite } from '@/api/entreprises';
import {
  bandeauSeverityClass,
  buildContexteEntreprise,
  downloadModuleMarkdown,
  extractDiagnosticError,
  extractModuleError,
  fmtEuros,
  recommandationPriorityClass,
  scoreBadgeSeverityClass,
} from './helpers';

/**
 * Tests des fonctions pures de la fiche entreprise.
 *
 * Ce sont des tables de correspondance et des extractions défensives : leur
 * valeur est dans les cas limites — sévérité inconnue, réponse d'erreur
 * incomplète, montant nul — qui décident de ce que l'écran affiche.
 */

const identite = (surcharges: Partial<Identite> = {}): Identite =>
  ({
    siren: '123456789',
    raison_sociale: 'Boulangerie Dupont',
    code_naf: '1071C',
    libelle_naf: 'Boulangerie et boulangerie-pâtisserie',
    ville: 'Lyon',
    effectif_tranche: '11',
    effectif_estime: 12,
    ...surcharges,
  }) as Identite;

describe('bandeauSeverityClass', () => {
  it('distingue les trois sévérités connues', () => {
    expect(bandeauSeverityClass({ severity: 'faible' })).toContain('emerald');
    expect(bandeauSeverityClass({ severity: 'modéré' })).toContain('amber');
    expect(bandeauSeverityClass({ severity: 'élevé' })).toContain('red');
  });

  it('traite une sévérité inconnue comme un risque', () => {
    // Face à un libellé qu'on ne connaît pas, mieux vaut alerter que rassurer.
    expect(bandeauSeverityClass({ severity: 'inconnue' })).toContain('red');
  });

  it('reste neutre sans scoring du tout', () => {
    expect(bandeauSeverityClass(null)).toBe('bg-muted');
    expect(bandeauSeverityClass(undefined)).toBe('bg-muted');
  });
});

describe('scoreBadgeSeverityClass', () => {
  it('distingue les trois sévérités connues', () => {
    expect(scoreBadgeSeverityClass('faible')).toContain('emerald');
    expect(scoreBadgeSeverityClass('modéré')).toContain('amber');
    expect(scoreBadgeSeverityClass('élevé')).toContain('red');
  });

  it('traite une sévérité absente comme un risque', () => {
    expect(scoreBadgeSeverityClass(undefined)).toContain('red');
  });
});

describe('recommandationPriorityClass', () => {
  it('sépare les priorités hautes, moyennes et basses', () => {
    expect(recommandationPriorityClass(1)).toContain('red');
    expect(recommandationPriorityClass(2)).toContain('red');
    expect(recommandationPriorityClass(3)).toContain('amber');
    expect(recommandationPriorityClass(4)).toContain('amber');
    expect(recommandationPriorityClass(5)).toContain('muted');
  });
});

describe('fmtEuros', () => {
  it('abrège les millions avec deux décimales et une virgule', () => {
    expect(fmtEuros(2_400_000)).toBe('2,40M €');
    expect(fmtEuros(-1_500_000)).toBe('-1,50M €');
  });

  it('abrège les milliers en arrondissant', () => {
    expect(fmtEuros(180_000)).toBe('180K €');
    expect(fmtEuros(1_500)).toBe('2K €');
  });

  it('laisse les petits montants entiers', () => {
    expect(fmtEuros(850)).toBe('850 €');
    expect(fmtEuros(0)).toBe('0 €');
  });

  it('affiche un tiret plutôt qu’un zéro pour une valeur absente', () => {
    // Confondre « non renseigné » et « zéro » fausse la lecture d'un bilan.
    expect(fmtEuros(null)).toBe('—');
    expect(fmtEuros(undefined)).toBe('—');
  });
});

describe('extractDiagnosticError', () => {
  it('privilégie le message métier du backend', () => {
    expect(
      extractDiagnosticError({
        response: { data: { error: { message: 'Analyse expirée' } } },
      }),
    ).toBe('Analyse expirée');
  });

  it('retombe sur le statut HTTP', () => {
    expect(extractDiagnosticError({ response: { statusText: 'Bad Gateway' } })).toBe(
      'Bad Gateway',
    );
  });

  it('retombe sur un message propre au diagnostic', () => {
    expect(extractDiagnosticError(new Error('offline'))).toBe(
      "Le diagnostic consultant n'est pas disponible pour le moment.",
    );
  });
});

describe('extractModuleError', () => {
  it('privilégie le message métier du backend', () => {
    expect(
      extractModuleError({
        response: { data: { error: { message: 'Module indisponible' } } },
      }),
    ).toBe('Module indisponible');
  });

  it('accepte un corps d’erreur renvoyé en texte brut', () => {
    expect(extractModuleError({ response: { data: 'quota dépassé' } })).toBe(
      'quota dépassé',
    );
  });

  it('ignore un corps texte vide et retombe sur l’exception', () => {
    expect(extractModuleError({ response: { data: '' }, message: 'timeout' })).toBe(
      'timeout',
    );
  });

  it('retombe sur un message générique en dernier recours', () => {
    expect(extractModuleError({})).toBe('Une erreur est survenue.');
    expect(extractModuleError(null)).toBe('Une erreur est survenue.');
  });
});

describe('buildContexteEntreprise', () => {
  it('assemble le contexte injecté au prompt', () => {
    const texte = buildContexteEntreprise(
      identite(),
      'Boulangerie Dupont',
      '123456789',
      { nom_metier: 'Boulangerie artisanale' },
    );

    expect(texte).toContain('Entreprise : Boulangerie Dupont');
    expect(texte).toContain('SIREN : 123456789');
    expect(texte).toContain('Code NAF : 1071C — Boulangerie et boulangerie-pâtisserie');
    expect(texte).toContain('Ville : Lyon');
    expect(texte).toContain('Métier détecté : Boulangerie artisanale');
  });

  it('omet le libellé NAF quand il manque', () => {
    const texte = buildContexteEntreprise(
      identite({ libelle_naf: null }),
      'X',
      '1',
      null,
    );

    expect(texte).toContain('Code NAF : 1071C');
    expect(texte).not.toContain('—');
  });

  it('n’inscrit que les champs renseignés', () => {
    const texte = buildContexteEntreprise(
      identite({
        code_naf: null,
        ville: null,
        effectif_tranche: null,
        effectif_estime: null,
      }),
      'Société X',
      '999999999',
      undefined,
    );

    expect(texte).toBe('Entreprise : Société X\nSIREN : 999999999');
  });

  it('distingue un effectif estimé nul d’un effectif absent', () => {
    const texte = buildContexteEntreprise(
      identite({ code_naf: null, ville: null, effectif_tranche: null, effectif_estime: 0 }),
      'X',
      '1',
      null,
    );

    // `0` est une information : seul `null` doit faire disparaître la ligne.
    expect(texte).toContain('Effectif estimé : 0');
  });
});

describe('downloadModuleMarkdown', () => {
  it('déclenche le téléchargement puis libère l’URL temporaire', () => {
    const creerURL = vi.fn(() => 'blob:local/1');
    const libererURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: creerURL, revokeObjectURL: libererURL });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadModuleMarkdown('# Titre', 'livrable.md');

    expect(creerURL).toHaveBeenCalled();
    expect(clic).toHaveBeenCalled();
    // Sans révocation, chaque export laisserait un blob en mémoire.
    expect(libererURL).toHaveBeenCalledWith('blob:local/1');
    expect(document.querySelector('a[download]')).toBeNull();

    vi.unstubAllGlobals();
    clic.mockRestore();
  });
});
