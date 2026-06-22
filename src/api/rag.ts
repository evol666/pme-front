import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API RAG (recherche sémantique + ask + documents + stats).
// Backend Spring Boot : RagResource (/api/rag). Les payloads internes du
// contrôleur (ChunkView, RagCitation, RagAnswer, RagStats) utilisent des
// champs public snake_case — Jackson les sérialise tels quels. L'entité
// RagDocument exposée directement par /documents utilise des getters Java
// → wire camelCase. Aucune conversion de cas côté front (cf. axiosClient :
// seul le path /api/* est réécrit en /services/pme/api/*).
//
// Endpoints couverts :
//  - GET    /api/rag/documents           -> { items: RagDocument[] } (camelCase)
//  - GET    /api/rag/documents/{id}      -> { document, chunks } (mixte)
//  - POST   /api/rag/search              -> { items: ChunkView[] } (snake_case)
//  - POST   /api/rag/ask                 -> RagAnswer (snake_case partiel)
//  - GET    /api/rag/stats               -> RagStats (snake_case)
//  - POST   /api/rag/ingest              -> RagDocument (non exposé ici, page search only)
//
// Champs @Lob (tags, attributes, error) = string JSON potentiel → parsing
// défensif côté UI via parseRagJsonObject.

// --- Types wire (match exact backend) ---

export interface RagDocument {
  id: number;
  sourceKind: string;
  sourceId: string | null;
  title: string;
  uri: string | null;
  checksum: string | null;
  language: string | null;
  tags: string | null; // @Lob
  attributes: string | null; // @Lob
  status: RagDocumentStatus;
  error: string | null; // @Lob
  chunkCount: number;
  sizeBytes: number | null;
  ingestedAt: string;
  indexedAt: string | null;
  tenant: { id: number; slug?: string | null; name?: string | null } | null;
  user: { id: number } | null;
}

export type RagDocumentStatus =
  | "PENDING"
  | "INDEXING"
  | "INDEXED"
  | "ERROR"
  | "DELETED";

// ChunkView (champs public snake_case côté Java).
export interface RagChunkView {
  id: string | null;
  document_id: string | null;
  ordinal: number | null;
  text: string | null;
  section: string | null;
  tokens: number | null;
  score: number | null;
}

export interface RagSearchResponse {
  items: RagChunkView[];
}

export interface RagCitation {
  index: number | null;
  document_id: string | null;
  chunk_id: string | null;
  title: string | null;
  source_kind: string | null;
  section: string | null;
  excerpt: string | null;
  score: number | null;
}

export interface RagAnswer {
  question: string | null;
  answer: string | null;
  citations: RagCitation[] | null;
  grounded: boolean | null;
  model: string | null;
  mock: boolean | null;
  elapsed_ms: number | null;
}

export interface RagStats {
  documents_total: number;
  chunks_total: number;
  by_source_kind: Record<string, number> | null;
}

export interface RagDocumentListResponse {
  items: RagDocument[];
}

export interface RagSearchRequest {
  query: string;
  k?: number;
  source_kinds?: string[];
}

export interface RagAskRequest {
  question: string;
  k?: number;
  source_kinds?: string[];
}

// --- Query Keys ---

export const ragKeys = {
  all: ["rag"] as const,
  documents: (params: {
    sourceKind?: string;
    tag?: string;
    limit?: number;
  }) => ["rag", "documents", params] as const,
  stats: ["rag", "stats"] as const,
};

// --- Utilitaires ---

// Parse défensivement un @Lob contenant un objet JSON. Renvoie null si
// absent/mal formé.
export function parseRagJsonObject(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Extrait le message backend depuis une erreur axios. À utiliser avec
// sonner.toast.error côté composant.
export function extractBackendError(err: unknown): string {
  const axiosErr = err as {
    response?: {
      data?: { error?: { message?: string }; detail?: string };
      statusText?: string;
    };
  };
  return (
    axiosErr?.response?.data?.error?.message ??
    axiosErr?.response?.data?.detail ??
    axiosErr?.response?.statusText ??
    "Une erreur est survenue. Réessayez."
  );
}

// --- Hooks ---

export function useRagDocuments(
  params: { sourceKind?: string; tag?: string; limit?: number } = {},
) {
  return useQuery({
    queryKey: ragKeys.documents(params),
    queryFn: async () => {
      const { data } = await axiosClient.get<RagDocumentListResponse>(
        "/api/rag/documents",
        {
          params: {
            source_kind: params.sourceKind,
            tag: params.tag,
            limit: params.limit,
          },
        },
      );
      return data;
    },
  });
}

export function useRagStats() {
  return useQuery({
    queryKey: ragKeys.stats,
    queryFn: async () => {
      const { data } = await axiosClient.get<RagStats>("/api/rag/stats");
      return data;
    },
    refetchInterval: 60000,
  });
}

export function useRagSearch() {
  return useMutation({
    mutationFn: async (request: RagSearchRequest) => {
      const { data } = await axiosClient.post<RagSearchResponse>(
        "/api/rag/search",
        request,
      );
      return data;
    },
  });
}

export function useRagAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: RagAskRequest) => {
      const { data } = await axiosClient.post<RagAnswer>("/api/rag/ask", request);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ragKeys.all }),
  });
}