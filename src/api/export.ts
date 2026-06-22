import axiosClient from "@/api/axiosClient";
import { useMutation } from "@tanstack/react-query";

// Hooks API pour l'export de proposition (PDF/DOCX).
// Backend: ExportResource (/api/export/pdf, /api/export/docx).
// Les champs de Proposal sont camelCase sur le wire (record Java camelCase,
// aucune naming strategy snake_case globale).

// --- Types (match exact avec le wire backend) ---

export interface ProposalRecommendation {
  titre: string;
  description: string;
  priorite: string;
}

export interface ProposalActionStep {
  titre: string;
  description: string;
  duree: string;
}

export interface Proposal {
  executiveSummary: string;
  contextAnalysis: string;
  recommendations: ProposalRecommendation[];
  actionPlan: ProposalActionStep[];
  expectedBenefits: string;
  nextSteps: string;
}

export interface ExportRequest {
  proposition: Proposal;
  meta?: {
    company_name?: string;
    metier_label?: string;
  };
}

export type ExportFormat = "pdf" | "docx";

// --- Hooks ---

function downloadBlob(bytes: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const EXPORT_META = {
  pdf: { mime: "application/pdf", filename: "proposition_metier.pdf" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filename: "proposition_metier.docx",
  },
} as const;

export function useExportDocument() {
  return useMutation({
    mutationFn: async ({
      format,
      request,
    }: {
      format: ExportFormat;
      request: ExportRequest;
    }) => {
      const { data } = await axiosClient.post(`/api/export/${format}`, request, {
        responseType: "blob",
      });
      const meta = EXPORT_META[format];
      downloadBlob(data, meta.filename, meta.mime);
      return data;
    },
  });
}