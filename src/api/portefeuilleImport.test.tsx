import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAxiosClient, createTestQueryClient, createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import { portefeuilleKeys } from './portefeuille';
import {
  downloadTemplate,
  getSireneImportStatus,
  getSireneStats,
  startSireneImport,
  useImportCsv,
  type ImportReport,
} from './portefeuilleImport';

vi.mock('./axiosClient', () => ({
  default: createMockAxiosClient(),
}));

describe('useImportCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads the file as multipart/form-data and invalidates the portefeuille list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const report: ImportReport = {
      imported: 3,
      skipped: 1,
      importedSirens: ['111111111', '222222222', '333333333'],
      skippedSirens: ['444444444'],
      errors: [],
    };
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: report });

    const file = new File(['siren\n111111111'], 'portefeuille.csv', { type: 'text/csv' });
    const { result } = renderHook(() => useImportCsv(), {
      wrapper: createTestWrapper(queryClient),
    });

    result.current.mutate(file);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith(
      '/api/portefeuille/import-csv',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    expect(result.current.data).toEqual(report);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: portefeuilleKeys.all });
  });
});

describe('downloadTemplate', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it('fetches the CSV template as text and triggers a download', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: 'siren;label\n' });

    await downloadTemplate();

    expect(axiosClient.get).toHaveBeenCalledWith('/api/portefeuille/template', {
      responseType: 'text',
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('startSireneImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to trigger the full Sirene import', async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({
      data: { status: 'started', message: 'Import lancé' },
    });

    await expect(startSireneImport()).resolves.toEqual({ status: 'started', message: 'Import lancé' });
    expect(axiosClient.post).toHaveBeenCalledWith('/api/sirene/import');
  });
});

describe('getSireneImportStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GETs the Sirene import progress', async () => {
    const status = {
      running: true,
      phase: 'downloading',
      processed: 10,
      upserted: 8,
      skipped: 2,
      error: null,
      startedAt: '2026-07-20T09:00:00Z',
      finishedAt: null,
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: status });

    await expect(getSireneImportStatus()).resolves.toEqual(status);
    expect(axiosClient.get).toHaveBeenCalledWith('/api/sirene/import/status');
  });
});

describe('getSireneStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GETs the local Sirene database stats', async () => {
    const stats = { actives: 1000, cessees: 200, total: 1200 };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: stats });

    await expect(getSireneStats()).resolves.toEqual(stats);
    expect(axiosClient.get).toHaveBeenCalledWith('/api/sirene/stats');
  });
});
