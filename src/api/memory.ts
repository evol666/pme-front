import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Memory (mémoire vivante + Memory Hub) — version Spring Boot CRUD.
// Backend : MemoryDocumentResource (/api/memory-documents), MemoryEventResource
// (/api/memory-events). CRUD JHipster standard avec Criteria + pagination.
//
// DTOs Spring Boot en camelCase (naming strategy Jackson). Les champs @Lob
// (content, embedding, summary, payload) sont des chaînes — potentiellement du
// JSON sérialisé pour les structures complexes (embedding, payload), ou du texte
// libre pour content/summary. On parse défensivement via les helpers en bas de
// fichier.

// --- Types communs ---

interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
}

export interface MemoryDocument {
  id: number;
  kind: string; // expertise | context | preference … (max 32)
  title: string; // max 255
  content: string | null; // @Lob : texte libre ou JSON sérialisé
  embedding: string | null; // @Lob : JSON sérialisé (vecteur)
  status: string; // active | archived … (max 16)
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export interface MemoryEvent {
  id: number;
  kind: string; // observation | decision | feedback … (max 32)
  summary: string | null; // @Lob : texte libre
  payload: string | null; // @Lob : JSON sérialisé (détails bruts)
  createdAt: string;
  tenant: TenantRef;
}

export interface MemoryDocumentFilters {
  kind?: string;
  status?: string;
  titleContains?: string;
}

export interface MemoryEventFilters {
  kind?: string;
}

// --- Query Keys ---

export const memoryKeys = {
  all: ["memory"] as const,
  documents: (filters: MemoryDocumentFilters) =>
    ["memory", "documents", filters] as const,
  document: (id: number) => ["memory", "document", id] as const,
  events: (filters: MemoryEventFilters) => ["memory", "events", filters] as const,
  event: (id: number) => ["memory", "event", id] as const,
};

// --- Documents ---

export function useMemoryDocuments(filters: MemoryDocumentFilters = {}) {
  return useQuery({
    queryKey: memoryKeys.documents(filters),
    queryFn: async () => {
      const params: Record<string, string> = {
        page: "0",
        size: "200",
        sort: "createdAt,desc",
      };
      if (filters.kind) params["kind.equals"] = filters.kind;
      if (filters.status) params["status.equals"] = filters.status;
      if (filters.titleContains) params["title.contains"] = filters.titleContains;
      const { data } = await axiosClient.get<MemoryDocument[]>(
        "/api/memory-documents",
        { params },
      );
      return data;
    },
  });
}

export function useCreateMemoryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: string;
      title: string;
      content?: string | null;
      status?: string;
    }) => {
      const body = {
        kind: input.kind,
        title: input.title,
        content: input.content ?? null,
        status: input.status ?? "active",
      };
      const { data } = await axiosClient.post<MemoryDocument>(
        "/api/memory-documents",
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memoryKeys.all }),
  });
}

export function useDeleteMemoryDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/memory-documents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memoryKeys.all }),
  });
}

// --- Events ---

export function useMemoryEvents(filters: MemoryEventFilters = {}) {
  return useQuery({
    queryKey: memoryKeys.events(filters),
    queryFn: async () => {
      const params: Record<string, string> = {
        page: "0",
        size: "200",
        sort: "createdAt,desc",
      };
      if (filters.kind) params["kind.equals"] = filters.kind;
      const { data } = await axiosClient.get<MemoryEvent[]>("/api/memory-events", {
        params,
      });
      return data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}

export function useMemoryEvent(id: number | null) {
  return useQuery({
    queryKey: id ? memoryKeys.event(id) : ["memory", "event", "none"],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<MemoryEvent>(
        `/api/memory-events/${id}`,
      );
      return data;
    },
  });
}

// --- Utilitaires ---

// Parse défensivement un @Lob contenant un objet JSON (ex. payload, embedding).
// Renvoie null si absent ou mal formé.
export function parseMemoryJsonObject(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Extrait un excerpt lisible d'un champ @Lob `content` :
// - si JSON structuré → on tente de renvoyer une clé textuelle representative
//   (`text` / `summary` / `body` / `content`) ou un fallback compact ;
// - si texte libre → on le renvoie tel quel (tronqué par l'appelant via line-clamp).
export function extractContentExcerpt(
  raw: string | null | undefined,
  max = 240,
): string {
  if (!raw) return "";
  const asObject = parseMemoryJsonObject(raw);
  if (asObject) {
    const candidate =
      (asObject.text as string | undefined) ??
      (asObject.summary as string | undefined) ??
      (asObject.body as string | undefined) ??
      (asObject.content as string | undefined);
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.length > max ? `${candidate.slice(0, max)}…` : candidate;
    }
    return raw.slice(0, max);
  }
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}