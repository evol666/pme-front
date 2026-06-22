import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API « Réseau » (LOT cartographie business). Version Spring Boot CRUD.
// Backend : BusinessEntityResource (/api/business-entities), ConnectionResource
// (/api/connections), NetworkInsightResource (/api/network-insights),
// NetworkSyncStateResource (/api/network-sync-states).
//
// Écarts vs l'ancien frontend : `Connection` n'est PAS une arête de graphe entités↔entités
// (pas de sourceEntity/targetEntity) — c'est une connexion OAuth/API à un provider externe.
// Aucun backend ne modélise les liens entre BusinessEntity → la page Réseau est basée sur
// le CRUD seul (4 onglets). Voir [[pme-migration-fastapi-only-endpoints]].
//
// SÉCURITÉ : Connection.accessToken / refreshToken sont des @Lob sensibles — jamais
// exposés au client (la page n'affiche qu'un booléen de présence).

// DTOs Spring Boot en camelCase (naming strategy Jackson standard).

export type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING";

interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
}

export interface BusinessEntity {
  id: number;
  kind: string; // chaîne libre (client, fournisseur, partenaire…)
  externalRef: string | null;
  label: string;
  attributes: string | null; // @Lob : objet JSON sérialisé
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export interface Connection {
  id: number;
  provider: string;
  displayName: string | null;
  status: ConnectionStatus;
  scopes: string | null; // @Lob : JSON potentiel
  accountEmail: string | null;
  accountId: string | null;
  accessToken: string | null; // @Lob — SECRET, ne pas afficher
  refreshToken: string | null; // @Lob — SECRET, ne pas afficher
  tokenExpiresAt: string | null;
  metadataJson: string | null; // @Lob : JSON
  lastSyncAt: string | null;
  lastError: string | null; // @Lob
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export interface NetworkInsight {
  id: number;
  kind: string; // chaîne libre (opportunity, risk, synergy…)
  title: string;
  summary: string | null; // @Lob
  score: number | null;
  createdAt: string;
  tenant: TenantRef;
}

export interface NetworkSyncState {
  id: number;
  provider: string;
  lastSyncAt: string | null;
  cursor: string | null;
  status: string; // chaîne libre (max 16)
  updatedAt: string;
  tenant: TenantRef;
}

// --- Query Keys ---

export const networkKeys = {
  all: ["network"] as const,
  entities: (kind?: string, labelContains?: string) =>
    ["network", "entities", { kind, labelContains }] as const,
  connections: (provider?: string, status?: ConnectionStatus) =>
    ["network", "connections", { provider, status }] as const,
  insights: (kind?: string) => ["network", "insights", { kind }] as const,
  syncStates: (provider?: string, status?: string) =>
    ["network", "syncStates", { provider, status }] as const,
};

// --- Business entities ---

export function useBusinessEntities(kind?: string, labelContains?: string) {
  return useQuery({
    queryKey: networkKeys.entities(kind, labelContains),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (kind) params["kind.equals"] = kind;
      if (labelContains) params["label.contains"] = labelContains;
      const { data } = await axiosClient.get<BusinessEntity[]>("/api/business-entities", {
        params,
      });
      return data;
    },
  });
}

export function useCreateBusinessEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: string;
      label: string;
      externalRef?: string | null;
      attributes?: string | null;
    }) => {
      const { data } = await axiosClient.post<BusinessEntity>("/api/business-entities", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: networkKeys.all }),
  });
}

export function useDeleteBusinessEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/business-entities/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: networkKeys.all }),
  });
}

// --- Connections ---

export function useConnections(provider?: string, status?: ConnectionStatus) {
  return useQuery({
    queryKey: networkKeys.connections(provider, status),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (provider) params["provider.equals"] = provider;
      if (status) params["status.equals"] = status;
      const { data } = await axiosClient.get<Connection[]>("/api/connections", { params });
      return data;
    },
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/connections/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: networkKeys.all }),
  });
}

// --- Network insights ---

export function useNetworkInsights(kind?: string) {
  return useQuery({
    queryKey: networkKeys.insights(kind),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (kind) params["kind.equals"] = kind;
      const { data } = await axiosClient.get<NetworkInsight[]>("/api/network-insights", {
        params,
      });
      return data;
    },
  });
}

export function useDeleteNetworkInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/network-insights/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: networkKeys.all }),
  });
}

// --- Network sync states ---

export function useNetworkSyncStates(provider?: string, status?: string) {
  return useQuery({
    queryKey: networkKeys.syncStates(provider, status),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (provider) params["provider.equals"] = provider;
      if (status) params["status.equals"] = status;
      const { data } = await axiosClient.get<NetworkSyncState[]>(
        "/api/network-sync-states",
        { params },
      );
      return data;
    },
  });
}

// --- Utilitaire ---

// Parse défensivement un @Lob contenant un objet JSON (ex. attributes, scopes, metadata).
// Renvoie null si absent ou mal formé.
export function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
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