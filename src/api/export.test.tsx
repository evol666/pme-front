import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAxiosClient, createTestWrapper } from '@athanor/test-utils';
import axiosClient from './axiosClient';
import { useExportDocument, type ExportRequest } from './export';

vi.mock('./axiosClient', () => ({
  default: createMockAxiosClient(),
}));

const mockRequest: ExportRequest = {
  proposition: {
    executiveSummary: 'résumé',
    contextAnalysis: 'contexte',
    recommendations: [],
    actionPlan: [],
    expectedBenefits: 'bénéfices',
    nextSteps: 'suite',
  },
};

describe('useExportDocument', () => {
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

  it('POSTs the proposal as a PDF blob and triggers a download with the PDF filename', async () => {
    const blob = new Blob(['%PDF-1.4']);
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: blob });

    const { result } = renderHook(() => useExportDocument(), { wrapper: createTestWrapper() });

    result.current.mutate({ format: 'pdf', request: mockRequest });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/export/pdf', mockRequest, {
      responseType: 'blob',
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('POSTs the proposal as a DOCX blob and triggers a download with the DOCX filename', async () => {
    const blob = new Blob(['PK']);
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: blob });

    const { result } = renderHook(() => useExportDocument(), { wrapper: createTestWrapper() });

    result.current.mutate({ format: 'docx', request: mockRequest });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axiosClient.post).toHaveBeenCalledWith('/api/export/docx', mockRequest, {
      responseType: 'blob',
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
