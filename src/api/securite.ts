import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API sécurité/modération (LOT modération IA). Version Spring Boot.
// Backend : ModerationIncidentResource (/api/moderation-incidents, paginé Criteria
// severity.equals + category.equals + direction.equals + actionTaken.equals + sort).
// Pas d'endpoint stats ni export CSV côté Spring Boot (FastAPI-only) — compteurs
// dérivés côté front depuis la page chargée. Voir [[pme-migration-fastapi-only-endpoints]].

// DTOs Spring Boot en camelCase (naming strategy Jackson standard). Les champs @Lob
// (matchedPattern, excerptRedacted, metadataJson) sont des chaînes (JSON sérialisé pour
// metadataJson). Aucun champ @Lob ne doit entrer dans les criteria.

export type AlertSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// Le DTO réel n'expose pas de champ `status`/`resolvedAt` — l'état d'action de
// modération est porté par `actionTaken` (string ≤ 24). Les valeurs sémantiques
// utilisées par le front pour les actions de l'analyste : new | seen | resolved |
// dismissed. Le backend ne valide pas ces valeurs (colonne String libre), mais le
// front les traite comme un statut d'incident.
export type IncidentAction =
  | "new"
  | "seen"
  | "resolved"
  | "dismissed"
  | "blocked"
  | "warning"
  | "allowed"
  | string;

export interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
}

export interface AppUserRef {
  id: number;
  login?: string | null;
  email?: string | null;
}

export interface ModerationIncident {
  id: number;
  direction: string; // input | output (≤ 16)
  category: string; // ex. prompt_injection, pii_leak, secret_leak, hallucination… (≤ 32)
  severity: AlertSeverity;
  actionTaken: string; // ≤ 24 — porte le statut d'action (new|seen|resolved|dismissed|blocked|warning|allowed)
  ruleId: string | null; // ≤ 64
  matchedPattern: string | null; // @Lob
  excerptRedacted: string | null; // @Lob
  source: string | null; // ≤ 64
  requestId: string | null; // ≤ 64
  metadataJson: string | null; // @Lob : objet JSON sérialisé
  createdAt: string;
  tenant: TenantRef;
  user: AppUserRef | null;
}

// --- Query Keys ---

export const securiteKeys = {
  all: ["securite"] as const,
  incidents: (filters: {
    severity?: AlertSeverity;
    category?: string;
    direction?: string;
    actionTaken?: string;
  }) => ["securite", "incidents", filters] as const,
};

// --- Liste paginée ---

export function useModerationIncidents(filters: {
  severity?: AlertSeverity;
  category?: string;
  direction?: string;
  actionTaken?: string;
}) {
  return useQuery({
    queryKey: securiteKeys.incidents(filters),
    queryFn: async () => {
      const params: Record<string, string> = {
        page: "0",
        size: "200",
        sort: "createdAt,desc",
      };
      if (filters.severity) params["severity.equals"] = filters.severity;
      if (filters.category) params["category.equals"] = filters.category;
      if (filters.direction) params["direction.equals"] = filters.direction;
      if (filters.actionTaken) params["actionTaken.equals"] = filters.actionTaken;
      const { data } = await axiosClient.get<ModerationIncident[]>(
        "/api/moderation-incidents",
        { params },
      );
      return data;
    },
  });
}

// --- Patch partiel (merge-patch+json) ---

export function usePatchModerationIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number } & Partial<ModerationIncident>) => {
      const { id, ...body } = input;
      const { data } = await axiosClient.patch<ModerationIncident>(
        `/api/moderation-incidents/${id}`,
        body,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securiteKeys.all }),
  });
}

// --- Delete ---

export function useDeleteModerationIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/moderation-incidents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securiteKeys.all }),
  });
}

// --- Utilitaires ---

// Parse défensivement un @Lob contenant un objet JSON (metadataJson). Renvoie null si
// absent ou mal formé.
export function parseIncidentMetadata(
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

// Mappe une valeur actionTaken vers un statut d'incident lisible pour l'UI.
export function incidentStatus(actionTaken: string | null | undefined): IncidentAction {
  if (!actionTaken) return "new";
  const normalized = actionTaken.toLowerCase();
  if (["seen", "resolved", "dismissed"].includes(normalized)) return normalized;
  if (normalized === "blocked" || normalized === "warning" || normalized === "allowed") {
    return normalized;
  }
  return actionTaken;
}