import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import {
  playbooksKeys,
  useAbandonPlaybookRun,
  useCompletePlaybookRun,
  usePatchPlaybookStep,
  usePlaybookIntelligence,
  usePlaybookRun,
  usePlaybookRuns,
  usePlaybooksCatalog,
  usePlaybooksOverview,
  useStartPlaybookRun,
} from './playbooks';
import {
  onboardingKeys,
  useCompleteOnboarding,
  useGenerateDeliverable,
  useGoToStep,
  useOnboardingDeliverables,
  useOnboardingState,
  useOnboardingWelcome,
  useRunDiagnostic,
  useSaveWelcome,
  useStartOnboarding,
} from './onboarding';

vi.mock('./axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const wrapper = () => createTestWrapper();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosClient.get).mockResolvedValue({ data: { items: [] } } as never);
  vi.mocked(axiosClient.post).mockResolvedValue({ data: { id: 'x' } } as never);
});

describe('playbooksKeys', () => {
  it('compose les clés', () => {
    expect(playbooksKeys.all).toEqual(['playbooks']);
    expect(playbooksKeys.run('r1')).toEqual(['playbooks', 'run', 'r1']);
  });
});

describe('lecture des playbooks', () => {
  it("charge la vue d'ensemble", async () => {
    const { result } = renderHook(() => usePlaybooksOverview(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/playbooks');
  });

  it('charge le catalogue', async () => {
    const { result } = renderHook(() => usePlaybooksCatalog(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/playbooks/catalog');
  });

  it('applique une limite par défaut aux exécutions', async () => {
    const { result } = renderHook(() => usePlaybookRuns(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/playbooks/runs?limit=30');
  });

  it('respecte la limite demandée', async () => {
    const { result } = renderHook(() => usePlaybookRuns(5), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/playbooks/runs?limit=5');
  });

  it('retombe sur la réponse brute si elle n’est pas enveloppée', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [{ id: 'r1' }] } as never);

    const { result } = renderHook(() => usePlaybookRuns(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'r1' }]);
  });

  it("reste inactif sans identifiant d'exécution", () => {
    const { result } = renderHook(() => usePlaybookRun(null), { wrapper: wrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it("encode l'identifiant d'exécution dans l'URL", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { id: 'r/1' } } as never);

    const { result } = renderHook(() => usePlaybookRun('r/1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/playbooks/r%2F1');
  });

  it("reste inactif sans clé de playbook pour l'intelligence", () => {
    const { result } = renderHook(() => usePlaybookIntelligence(''), {
      wrapper: wrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it("charge l'intelligence d'un playbook", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: { stats: {}, suggestions: [] },
    } as never);

    const { result } = renderHook(() => usePlaybookIntelligence('relance client'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith(
      '/api/playbooks/intelligence/relance%20client',
    );
  });
});

describe('cycle de vie d’une exécution', () => {
  it('démarre une exécution', async () => {
    const { result } = renderHook(() => useStartPlaybookRun(), { wrapper: wrapper() });

    result.current.mutate({ playbookKey: 'relance' } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/playbooks/run', {
      playbookKey: 'relance',
    });
  });

  it('met à jour une étape en encodant les identifiants', async () => {
    const { result } = renderHook(() => usePatchPlaybookStep(), { wrapper: wrapper() });

    result.current.mutate({
      runId: 'r/1',
      stepKey: 'étape 1',
      payload: { status: 'DONE' } as never,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith(
      '/api/playbooks/r%2F1/steps/%C3%A9tape%201',
      { status: 'DONE' },
    );
  });

  it('clôture une exécution', async () => {
    const { result } = renderHook(() => useCompletePlaybookRun(), {
      wrapper: wrapper(),
    });

    result.current.mutate('r1' as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/playbooks/r1/complete');
  });

  it('abandonne une exécution', async () => {
    const { result } = renderHook(() => useAbandonPlaybookRun(), {
      wrapper: wrapper(),
    });

    result.current.mutate('r1' as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/playbooks/r1/abandon');
  });

  it("remonte l'échec du démarrage", async () => {
    vi.mocked(axiosClient.post).mockRejectedValue(new Error('409'));
    const { result } = renderHook(() => useStartPlaybookRun(), { wrapper: wrapper() });

    result.current.mutate({ playbookKey: 'relance' } as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('onboardingKeys', () => {
  it('compose les clés', () => {
    expect(onboardingKeys.state()).toEqual(['onboarding', 'state']);
    expect(onboardingKeys.welcome()).toEqual(['onboarding', 'welcome']);
    expect(onboardingKeys.deliverables()).toEqual(['onboarding', 'deliverables']);
  });
});

describe('parcours onboarding', () => {
  it("charge l'état courant", async () => {
    const { result } = renderHook(() => useOnboardingState(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/onboarding/state');
  });

  it('démarre le parcours', async () => {
    const { result } = renderHook(() => useStartOnboarding(), { wrapper: wrapper() });

    result.current.mutate(undefined as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/onboarding/start');
  });

  it('navigue vers une étape', async () => {
    const { result } = renderHook(() => useGoToStep(), { wrapper: wrapper() });

    result.current.mutate('DIAGNOSTIC' as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/onboarding/step', {
      step: 'DIAGNOSTIC',
    });
  });

  it("charge l'écran de bienvenue", async () => {
    const { result } = renderHook(() => useOnboardingWelcome(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/onboarding/welcome');
  });

  it('enregistre les informations de bienvenue', async () => {
    const { result } = renderHook(() => useSaveWelcome(), { wrapper: wrapper() });

    result.current.mutate({ company_name: 'Acme', siren: '123456789' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/onboarding/welcome', {
      company_name: 'Acme',
      siren: '123456789',
    });
  });

  it('lance le diagnostic', async () => {
    const { result } = renderHook(() => useRunDiagnostic(), { wrapper: wrapper() });

    result.current.mutate(undefined as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/onboarding/diagnostic');
  });

  it('liste les livrables', async () => {
    const { result } = renderHook(() => useOnboardingDeliverables(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledWith('/api/onboarding/deliverables');
  });

  it('génère un livrable', async () => {
    const { result } = renderHook(() => useGenerateDeliverable(), {
      wrapper: wrapper(),
    });

    result.current.mutate('PITCH' as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/onboarding/deliverable', {
      kind: 'PITCH',
    });
  });

  it('termine le parcours', async () => {
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper: wrapper() });

    result.current.mutate(undefined as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/onboarding/complete');
  });

  it("remonte l'échec du diagnostic", async () => {
    vi.mocked(axiosClient.post).mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useRunDiagnostic(), { wrapper: wrapper() });

    result.current.mutate(undefined as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
