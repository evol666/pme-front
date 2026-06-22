import axiosClient from "@/api/axiosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Hooks API pour l'export de données et les snapshots (Sauvegarde & Restauration).
// Backend Spring Boot / JHipster — aucun endpoint FastAPI.
//
// Endpoints utilisés :
//   POST /api/export/pdf           — export proposition PDF (blob)
//   POST /api/export/docx          — export proposition DOCX (blob)
//   GET  /api/kpi-snapshots        — liste des snapshots KPI
//   POST /api/kpi-snapshots        — crée un snapshot KPI
//   GET  /api/timeline-snapshots   — liste des snapshots de timeline
//   POST /api/timeline-snapshots   — crée un snapshot de timeline

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KpiSnapshot {
  id: number;
  kpi: string;
  granularity: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  valuePrev?: number;
  metadataJson?: string;
}

export interface TimelineSnapshot {
  id: number;
  period: string;
  highlights?: string;
  stats?: string;
  createdAt: string;
}

export type ExportFormat = "pdf" | "docx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadBlob(bytes: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Export PDF / DOCX ───────────────────────────────────────────────────────

export function useExportData(format: ExportFormat) {
  const mime =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const filename = `export_pme_${new Date().toISOString().slice(0, 10)}.${format}`;

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await axiosClient.post(`/api/export/${format}`, payload, {
        responseType: "blob",
      });
      downloadBlob(data, filename, mime);
      return data;
    },
  });
}

// ─── Snapshots KPI ───────────────────────────────────────────────────────────

export function useKpiSnapshots(page = 0, size = 20) {
  return useQuery<KpiSnapshot[]>({
    queryKey: ["kpi-snapshots", page, size],
    queryFn: async () => {
      const { data } = await axiosClient.get("/api/kpi-snapshots", {
        params: { page, size, sort: "periodStart,desc" },
      });
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCreateKpiSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<KpiSnapshot, "id">) => {
      const { data } = await axiosClient.post<KpiSnapshot>("/api/kpi-snapshots", payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kpi-snapshots"] });
    },
  });
}

// ─── Snapshots Timeline ──────────────────────────────────────────────────────

export function useTimelineSnapshots(page = 0, size = 20) {
  return useQuery<TimelineSnapshot[]>({
    queryKey: ["timeline-snapshots", page, size],
    queryFn: async () => {
      const { data } = await axiosClient.get("/api/timeline-snapshots", {
        params: { page, size, sort: "createdAt,desc" },
      });
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCreateTimelineSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<TimelineSnapshot, "id" | "createdAt">) => {
      const { data } = await axiosClient.post<TimelineSnapshot>("/api/timeline-snapshots", payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timeline-snapshots"] });
    },
  });
}
