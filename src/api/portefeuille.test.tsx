import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  portefeuilleKeys,
  RELATION_TYPES,
  useAddEntreprise,
  usePortefeuille,
  usePortefeuilleEntreprise,
  useRemoveEntreprise,
  useUpdateEntreprise,
} from './portefeuille';

/**
 * Tests du portefeuille d'entreprises. Le point délicat est la conversion
 * `BusinessEntity` → `EntreprisePortefeuille` : le SIREN vit dans `externalRef`
 * et doit faire exactement 9 chiffres, le reste des champs est sérialisé en
 * JSON dans `attributes`. Toute entité qui ne respecte pas ce contrat doit être
 * écartée silencieusement plutôt que d'apparaître incomplète dans l'interface.
 */

vi.mock('./axiosClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(axiosClient.get);
const post = vi.mocked(axiosClient.post);
const put = vi.mocked(axiosClient.put);
const del = vi.mocked(axiosClient.delete);

const brut = (o: Record<string, unknown> = {}) => ({
  id: 1,
  kind: 'client',
  externalRef: '123456789',
  label: 'Acme SA',
  attributes: null,
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z',
  ...o,
});

const wrapper = () => ({ wrapper: createTestWrapper() });

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ data: [] } as never);
  post.mockResolvedValue({ data: brut() } as never);
  put.mockResolvedValue({ data: brut() } as never);
  del.mockResolvedValue({ data: {} } as never);
});

describe('référentiel des types de relation', () => {
  it('expose les cinq types attendus', () => {
    expect(RELATION_TYPES.map(r => r.value)).toEqual([
      'client',
      'prospect',
      'partenaire',
      'concurrent',
      'fournisseur',
    ]);
  });

  it('distingue les clés de cache par filtre', () => {
    expect(portefeuilleKeys.list()).toEqual(['portefeuille', 'list', 'all']);
    expect(portefeuilleKeys.list('client')).not.toEqual(portefeuilleKeys.list('prospect'));
  });
});

describe('liste du portefeuille', () => {
  it('n’envoie aucun filtre par défaut', async () => {
    const { result } = renderHook(() => usePortefeuille(), wrapper());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/business-entities', { params: {} });
  });

  it('traduit le type de relation en critère JHipster', async () => {
    const { result } = renderHook(() => usePortefeuille('prospect'), wrapper());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/business-entities', {
      params: { 'kind.equals': 'prospect' },
    });
  });

  it('convertit une entité complète', async () => {
    get.mockResolvedValue({
      data: [
        brut({
          attributes: JSON.stringify({
            notes: 'À relancer',
            codeNaf: '62.01Z',
            libelleNaf: 'Programmation',
            ville: 'Lyon',
            score: 78,
            severity: 'medium',
            statut: 'actif',
            effectifTranche: '10-19',
          }),
        }),
      ],
    } as never);

    const { result } = renderHook(() => usePortefeuille(), wrapper());

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]).toMatchObject({
      siren: '123456789',
      label: 'Acme SA',
      kind: 'client',
      notes: 'À relancer',
      codeNaf: '62.01Z',
      ville: 'Lyon',
      score: 78,
      effectifTranche: '10-19',
    });
  });

  it('met à null les champs absents des attributs', async () => {
    get.mockResolvedValue({ data: [brut()] } as never);

    const { result } = renderHook(() => usePortefeuille(), wrapper());

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]).toMatchObject({
      notes: null,
      codeNaf: null,
      ville: null,
      score: null,
      severity: null,
      statut: null,
      effectifTranche: null,
    });
  });

  it('ignore un score non numérique', async () => {
    get.mockResolvedValue({
      data: [brut({ attributes: JSON.stringify({ score: 'élevé' }) })],
    } as never);

    const { result } = renderHook(() => usePortefeuille(), wrapper());

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].score).toBeNull();
  });

  it('survit à des attributs JSON invalides', async () => {
    get.mockResolvedValue({ data: [brut({ attributes: '{pas du json' })] } as never);

    const { result } = renderHook(() => usePortefeuille(), wrapper());

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].siren).toBe('123456789');
    expect(result.current.data?.[0].notes).toBeNull();
  });

  it.each([
    ['SIREN absent', null],
    ['SIREN trop court', '12345678'],
    ['SIREN trop long', '1234567890'],
    ['SIREN non numérique', '12345678A'],
    ['SIREN vide', ''],
  ])('écarte une entité au %s', async (_libelle, externalRef) => {
    get.mockResolvedValue({ data: [brut({ externalRef })] } as never);

    const { result } = renderHook(() => usePortefeuille(), wrapper());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('écarte une entité dont le type n’est pas au référentiel', async () => {
    get.mockResolvedValue({
      data: [brut(), brut({ id: 2, kind: 'inconnu', externalRef: '987654321' })],
    } as never);

    const { result } = renderHook(() => usePortefeuille(), wrapper());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe(1);
  });
});

describe('recherche par SIREN', () => {
  it('interroge l’API sur le SIREN demandé', async () => {
    get.mockResolvedValue({ data: [brut()] } as never);

    const { result } = renderHook(
      () => usePortefeuilleEntreprise('123456789'),
      wrapper(),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/business-entities', {
      params: { 'externalRef.equals': '123456789' },
    });
    expect(result.current.data?.label).toBe('Acme SA');
  });

  it('retourne null quand aucune entité ne correspond', async () => {
    get.mockResolvedValue({ data: [brut({ externalRef: '987654321' })] } as never);

    const { result } = renderHook(
      () => usePortefeuilleEntreprise('123456789'),
      wrapper(),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['chaîne vide', ''],
  ])('reste inactive avec un SIREN %s', (_libelle, siren) => {
    const { result } = renderHook(() => usePortefeuilleEntreprise(siren), wrapper());

    expect(get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('ajout au portefeuille', () => {
  it('place le SIREN dans externalRef et sérialise le reste', async () => {
    const { result } = renderHook(() => useAddEntreprise(), wrapper());

    result.current.mutate({
      siren: '123456789',
      label: 'Acme SA',
      kind: 'client',
      notes: 'Prospect chaud',
      ville: 'Lyon',
    } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, corps] = post.mock.calls[0];
    expect(url).toBe('/api/business-entities');
    expect(corps).toMatchObject({
      kind: 'client',
      externalRef: '123456789',
      label: 'Acme SA',
    });
    expect(JSON.parse((corps as { attributes: string }).attributes)).toMatchObject({
      notes: 'Prospect chaud',
      ville: 'Lyon',
    });
  });

  it('remonte l’échec du serveur', async () => {
    post.mockRejectedValue(new Error('409 déjà présent'));
    const { result } = renderHook(() => useAddEntreprise(), wrapper());

    result.current.mutate({ siren: '123456789', label: 'X', kind: 'client' } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('mise à jour', () => {
  it('recharge l’entité pour préserver les attributs existants', async () => {
    get.mockResolvedValue({
      data: brut({ attributes: JSON.stringify({ ville: 'Lyon', score: 70 }) }),
    } as never);
    const { result } = renderHook(() => useUpdateEntreprise(), wrapper());

    result.current.mutate({ id: 1, notes: 'Nouvelle note' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/api/business-entities/1');
    const attrs = JSON.parse(put.mock.calls[0][1].attributes as string);
    // Les attributs d'enrichissement ne doivent pas être écrasés.
    expect(attrs).toEqual({ ville: 'Lyon', score: 70, notes: 'Nouvelle note' });
  });

  it('conserve le type et le libellé quand ils ne sont pas fournis', async () => {
    get.mockResolvedValue({ data: brut() } as never);
    const { result } = renderHook(() => useUpdateEntreprise(), wrapper());

    result.current.mutate({ id: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(put.mock.calls[0][1]).toMatchObject({ kind: 'client', label: 'Acme SA' });
  });

  it('applique le nouveau type et le nouveau libellé', async () => {
    get.mockResolvedValue({ data: brut() } as never);
    const { result } = renderHook(() => useUpdateEntreprise(), wrapper());

    result.current.mutate({ id: 1, kind: 'concurrent', label: 'Acme Group' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(put.mock.calls[0][1]).toMatchObject({
      kind: 'concurrent',
      label: 'Acme Group',
    });
  });

  it('n’écrit pas de note quand elle n’est pas fournie', async () => {
    get.mockResolvedValue({
      data: brut({ attributes: JSON.stringify({ notes: 'ancienne' }) }),
    } as never);
    const { result } = renderHook(() => useUpdateEntreprise(), wrapper());

    result.current.mutate({ id: 1, kind: 'prospect' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(put.mock.calls[0][1].attributes as string).notes).toBe('ancienne');
  });

  it('accepte l’effacement explicite d’une note', async () => {
    get.mockResolvedValue({
      data: brut({ attributes: JSON.stringify({ notes: 'ancienne' }) }),
    } as never);
    const { result } = renderHook(() => useUpdateEntreprise(), wrapper());

    result.current.mutate({ id: 1, notes: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(put.mock.calls[0][1].attributes as string).notes).toBeNull();
  });

  it('repart d’attributs vides si l’existant est illisible', async () => {
    get.mockResolvedValue({ data: brut({ attributes: '{pas du json' }) } as never);
    const { result } = renderHook(() => useUpdateEntreprise(), wrapper());

    result.current.mutate({ id: 1, notes: 'nouvelle' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(put.mock.calls[0][1].attributes as string)).toEqual({
      notes: 'nouvelle',
    });
  });
});

describe('suppression', () => {
  it('appelle l’API et retourne l’identifiant retiré', async () => {
    const { result } = renderHook(() => useRemoveEntreprise(), wrapper());

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(del).toHaveBeenCalledWith('/api/business-entities/3');
    expect(result.current.data).toBe(3);
  });

  it('remonte l’échec du serveur', async () => {
    del.mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useRemoveEntreprise(), wrapper());

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
