import { describe, expect, it } from 'vitest';
import { libelleTrancheEffectif } from './trancheEffectif';

describe('libelleTrancheEffectif', () => {
  it('returns null for null/undefined input', () => {
    expect(libelleTrancheEffectif(null)).toBeNull();
    expect(libelleTrancheEffectif(undefined)).toBeNull();
  });

  it('returns null for empty/whitespace-only input', () => {
    expect(libelleTrancheEffectif('')).toBeNull();
    expect(libelleTrancheEffectif('   ')).toBeNull();
  });

  it('maps known two-digit codes to their label', () => {
    expect(libelleTrancheEffectif('00')).toBe('0 salarié');
    expect(libelleTrancheEffectif('12')).toBe('20 à 49 salariés');
    expect(libelleTrancheEffectif('53')).toBe('10 000 salariés et plus');
  });

  it('handles the special NN (non renseigné) code', () => {
    expect(libelleTrancheEffectif('NN')).toBe('Effectif non renseigné');
  });

  it('pads single-digit codes with a leading zero', () => {
    expect(libelleTrancheEffectif('1')).toBe('1 ou 2 salariés');
    expect(libelleTrancheEffectif('0')).toBe('0 salarié');
  });

  it('trims surrounding whitespace before lookup', () => {
    expect(libelleTrancheEffectif('  12  ')).toBe('20 à 49 salariés');
  });

  it('falls back to a generic label for unknown codes', () => {
    expect(libelleTrancheEffectif('99')).toBe('Tranche 99');
    expect(libelleTrancheEffectif('ZZ')).toBe('Tranche ZZ');
  });
});
