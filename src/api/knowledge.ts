import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Knowledge (LOT 16) — version Spring Boot CRUD uniquement.
// Backend : KnowledgeEntityResource (/api/knowledge-entities), KnowledgeSignalResource
// (/api/knowledge-signals). Les endpoints graphe FastAPI (/api/knowledge/graph, /search,
// /stats, /signals/scan, /entities/{id}/neighbors, /timeline) n'existent pas côté Spring
// Boot — la page propose donc un explorateur CRUD (entités + signaux) sans graphe
// interactif. Voir [[pme-migration-fastapi-only-endpoints]].

// Les DTOs Spring Boot sont en camelCase (naming strategy Jackson standard). Les champs
// @Lob (attributes, tags, entityIds, evidence) sont sérialisés en chaînes JSON.

export type AlertSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TenantRef {
  id: number;
}

export interface KnowledgeEntity {
  id: number;
  kind: string;
  externalId: string | null;
  label: string;
  description: string | null;
  source: string | null;
  status: string | null;
  score: number | null;
  attributes: string | null; // @Lob : chaîne JSON
  tags: string | null; // @Lob : chaîne JSON (tableau sérialisé)
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export interface KnowledgeSignal {
  id: number;
  kind: string;
  title: string;
  summary: string | null;
  severity: AlertSeverity;
  score: number;
  entityIds: string | null; // @Lob : chaîne JSON (tableau d'ids)
  evidence: string | null; // @Lob : chaîne JSON
  status: string; // "open" | "resolved" | …
  createdAt: string;
  resolvedAt: string | null;
  tenant: TenantRef;
}

// --- Query Keys ---

export const knowledgeKeys = {
  all: ["knowledge"] as const,
  entities: (kind?: string, status?: string, labelContains?: string) =>
    ["knowledge", "entities", { kind, status, labelContains }] as const,
  entity: (id: number) => ["knowledge", "entity", id] as const,
  signals: (status?: string, kind?: string, severity?: AlertSeverity) =>
    ["knowledge", "signals", { status, kind, severity }] as const,
};

// --- Entités ---

export function useKnowledgeEntities(
  kind?: string,
  status?: string,
  labelContains?: string,
) {
  return useQuery({
    queryKey: knowledgeKeys.entities(kind, status, labelContains),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (kind) params["kind.equals"] = kind;
      if (status) params["status.equals"] = status;
      if (labelContains) params["label.contains"] = labelContains;
      const { data } = await axiosClient.get<KnowledgeEntity[]>(
        "/api/knowledge-entities",
        { params },
      );
      return data;
    },
  });
}

export function useKnowledgeEntity(id: number | null) {
  return useQuery({
    queryKey: id ? knowledgeKeys.entity(id) : ["knowledge", "entity", "none"],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<KnowledgeEntity>(
        `/api/knowledge-entities/${id}`,
      );
      return data;
    },
  });
}

export function useDeleteKnowledgeEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/knowledge-entities/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.all }),
  });
}

// --- Signaux ---

export function useKnowledgeSignals(
  status?: string,
  kind?: string,
  severity?: AlertSeverity,
) {
  return useQuery({
    queryKey: knowledgeKeys.signals(status, kind, severity),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status) params["status.equals"] = status;
      if (kind) params["kind.equals"] = kind;
      if (severity) params["severity.equals"] = severity;
      const { data } = await axiosClient.get<KnowledgeSignal[]>(
        "/api/knowledge-signals",
        { params },
      );
      return data;
    },
  });
}

// Résolution d'un signal : PATCH merge-patch avec statut "resolved" + horodatage UTC.
// Le backend exige un id non null dans le corps (partialUpdate vérifie getId()).
export function useResolveKnowledgeSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await axiosClient.patch<KnowledgeSignal>(
        `/api/knowledge-signals/${id}`,
        { id, status: "resolved", resolvedAt: new Date().toISOString() },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.all }),
  });
}

export function useDeleteKnowledgeSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/knowledge-signals/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.all }),
  });
}