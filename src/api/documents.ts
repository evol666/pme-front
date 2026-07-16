import axiosClient from "@/api/axiosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Hooks API pour la base documentaire RAG.
// Backend Spring Boot :
//   - DocumentUploadResource (/api/documents) — upload direct + URL présignée MinIO
//   - RagDocumentResource   (/api/rag-documents) — CRUD JHipster standard
// Réponses en camelCase (JHipster par défaut, pas de naming strategy snake_case).
// L'URL présignée renvoyée par /upload-url pointe vers MinIO directement (pas la
// gateway) : on l'utilise via fetch brut, jamais via axiosClient (sinon
// l'intercepteur réécrirait le chemin).

// --- Statuts du pipeline RAG (cf. RagDocumentStatus côté backend) ---

export type RagDocumentStatus = "PENDING" | "INDEXING" | "INDEXED" | "ERROR";

const TERMINAL_STATUSES: ReadonlySet<RagDocumentStatus> = new Set([
  "INDEXED",
  "ERROR",
]);

// --- Types (match exact avec le wire backend, camelCase) ---

export interface RagDocument {
  id: number;
  sourceKind: string;
  sourceId: string | null;
  siren: string | null;
  title: string;
  uri: string | null;
  checksum: string | null;
  language: string | null;
  tags: string | null;
  attributes: string | null;
  status: RagDocumentStatus;
  error: string | null;
  chunkCount: number;
  sizeBytes: number | null;
  ingestedAt: string;
  indexedAt: string | null;
  tenant: { id: number } | null;
  user: { id: number } | null;
}

export interface UploadUrlRequest {
  filename: string;
  contentType: string;
  sizeBytes?: number | null;
  sourceKind?: string;
  siren?: string | null;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  bucketName: string;
  documentId: number;
}

// --- Query Keys ---

export const documentsKeys = {
  all: ["documents"] as const,
  list: () => ["documents", "list"] as const,
  detail: (id: number) => ["documents", "detail", id] as const,
};

// --- Upload vers MinIO via URL présignée ---
// Hors gateway : fetch brut, on n'injecte ni credentials ni le rewrite /api.

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(`Upload MinIO échoué (HTTP ${res.status})`);
  }
}

// --- Hooks ---

export function useDocuments(siren?: string) {
  return useQuery({
    queryKey: [...documentsKeys.list(), { siren }] as const,
    queryFn: async () => {
      const params = siren ? { "siren.equals": siren } : undefined;
      const { data } = await axiosClient.get<RagDocument[]>("/api/rag-documents", {
        params,
      });
      return data;
    },
  });
}

export function useDocument(id: number | null | undefined) {
  return useQuery({
    queryKey: id ? documentsKeys.detail(id) : ["documents", "detail", "none"],
    enabled: id != null,
    // Un document en cours d'indexation passe par Kafka : on rafraîchit
    // jusqu'à un état terminal (INDEXED ou ERROR).
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !TERMINAL_STATUSES.has(status) ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await axiosClient.get<RagDocument>(
        `/api/rag-documents/${id}`,
      );
      return data;
    },
  });
}

export function useRequestUploadUrl() {
  return useMutation({
    mutationFn: async (request: UploadUrlRequest) => {
      const { data } = await axiosClient.post<UploadUrlResponse>(
        "/api/documents/upload-url",
        request,
      );
      return data;
    },
  });
}

export function useUploadDocumentDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      file: File;
      title?: string;
      sourceKind?: string;
      siren?: string;
    }) => {
      const form = new FormData();
      form.append("file", params.file);
      if (params.title) form.append("title", params.title);
      if (params.sourceKind) form.append("sourceKind", params.sourceKind);
      if (params.siren) form.append("siren", params.siren);
      const { data } = await axiosClient.post<RagDocument>(
        "/api/documents/upload",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/rag-documents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}