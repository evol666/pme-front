import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Connecteurs (LOT 15) — version Spring Boot CRUD.
// Backend : ConnectorSyncResource (/api/connector-syncs), ConnectorWebhookResource
// (/api/connector-webhooks). L'ancien frontend FastAPI exposait aussi une marketplace
// de providers (/api/connectors/providers), un health overview (/api/connectors/health)
// et des actions OAuth (connect/disconnect/refresh/sync) qui n'ont pas d'équivalent
// Spring Boot. Ces endpoints FastAPI-only ne sont pas migrés ici — la page se base sur
// le CRUD JHipster disponible. Voir [[pme-migration-fastapi-only-endpoints]].
//
// DTOs Spring Boot en camelCase (naming strategy Jackson standard). Les champs @Lob
// (error, payload, scopes, accessToken, refreshToken, metadataJson, lastError) sont
// des chaînes (JSON sérialisé pour payload/scopes). SÉCURITÉ : accessToken/refreshToken
// ne sont jamais affichés côté UI — seul un témoin de présence est montré (voir
// ReseauPage pour le modèle).

export type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING";

// Référence légère à une Connection (évite de dupliquer tout ConnectionDTO). Pour la
// gestion complète des connexions OAuth, voir ReseauPage + @/api/network.
export interface ConnectionRef {
  id: number;
  provider: string;
  displayName: string | null;
  status: ConnectionStatus;
  accountEmail: string | null;
  accountId: string | null;
}

export interface ConnectorSync {
  id: number;
  provider: string; // ex. google, microsoft, hubspot…
  entity: string; // ex. messages, deals, files…
  status: string; // String libre (SUCCESS, FAILED, RUNNING, PENDING…)
  trigger: string; // ex. manual, webhook, scheduler
  itemsCount: number;
  cursor: string | null;
  error: string | null; // @Lob
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  connection: ConnectionRef;
  tenant: { id: number };
}

export interface ConnectorWebhook {
  id: number;
  provider: string;
  eventType: string;
  externalId: string | null;
  payload: string | null; // @Lob : objet JSON sérialisé
  processed: boolean;
  processedAt: string | null;
  error: string | null; // @Lob
  receivedAt: string;
  tenant: { id: number } | null;
  connection: ConnectionRef | null;
}

// --- Query Keys ---

export const connectorsKeys = {
  all: ["connectors"] as const,
  syncs: (provider?: string, entity?: string, status?: string) =>
    ["connectors", "syncs", { provider, entity, status }] as const,
  webhooks: (provider?: string, processed?: boolean) =>
    ["connectors", "webhooks", { provider, processed }] as const,
};

// --- Syncs ---

export function useConnectorSyncs(provider?: string, entity?: string, status?: string) {
  return useQuery({
    queryKey: connectorsKeys.syncs(provider, entity, status),
    queryFn: async () => {
      const params: Record<string, string> = { size: "200" };
      if (provider) params["provider.equals"] = provider;
      if (entity) params["entity.equals"] = entity;
      if (status) params["status.equals"] = status;
      const { data } = await axiosClient.get<ConnectorSync[]>("/api/connector-syncs", {
        params,
      });
      // Tri par startedAt décroissant (plus récent d'abord), fallback createdAt.
      return data.sort((a, b) => {
        const ta = a.startedAt ?? a.createdAt;
        const tb = b.startedAt ?? b.createdAt;
        return tb.localeCompare(ta);
      });
    },
  });
}

export function useDeleteConnectorSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/connector-syncs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: connectorsKeys.all }),
  });
}

// --- Webhooks ---

export function useConnectorWebhooks(provider?: string, processed?: boolean) {
  return useQuery({
    queryKey: connectorsKeys.webhooks(provider, processed),
    queryFn: async () => {
      const params: Record<string, string> = { size: "200" };
      if (provider) params["provider.equals"] = provider;
      if (processed != null) params["processed.equals"] = String(processed);
      const { data } = await axiosClient.get<ConnectorWebhook[]>("/api/connector-webhooks", {
        params,
      });
      // Tri par receivedAt décroissant (plus récent d'abord).
      return data.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    },
  });
}

export function useDeleteConnectorWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/connector-webhooks/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: connectorsKeys.all }),
  });
}

// --- Utilitaires ---

// Parse défensivement un @Lob contenant un objet JSON (ex. payload de webhook). Renvoie
// null si absent ou mal formé. L'appelant peut ensuite inspecter les clés/valeurs.
export function parseJsonObject(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}