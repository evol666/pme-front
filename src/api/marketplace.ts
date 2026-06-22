import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Marketplace (catalogue de plugins + installations par tenant) — version
// Spring Boot CRUD. Backend : MarketplacePluginResource (/api/marketplace-plugins),
// MarketplaceInstallationResource (/api/marketplace-installations). La page v2
// utilisait des endpoints FastAPI dédiés (install/uninstall par plugin_id) qui
// n'existent pas côté Spring Boot : on les reconstruit depuis le CRUD
// (POST /marketplace-installations pour installer, DELETE pour désinstaller).
// Voir [[pme-migration-fastapi-only-endpoints]].

// DTOs Spring Boot en camelCase (naming strategy Jackson standard). Les champs @Lob
// (description, manifest, config) sont des chaînes — le manifest est une chaîne JSON
// sérialisée (description, version, keywords… selon le schéma du plugin).

export interface MarketplacePlugin {
  id: number;
  kind: string; // agent | workflow | connector | template | bundle
  label: string;
  description: string | null; // @Lob
  version: string;
  author: string | null;
  manifest: string | null; // @Lob : chaîne JSON
  status: string; // published | draft | deprecated …
  createdAt: string;
}

export interface TenantRef {
  id: number;
}

export interface PluginRef {
  id: number;
}

export interface MarketplaceInstallation {
  id: number;
  status: string; // installed | pending | failed | uninstalled
  config: string | null; // @Lob
  installedAt: string;
  tenant: TenantRef;
  plugin: PluginRef & Partial<MarketplacePlugin>;
}

// Champs optionnels extraits du manifest JSON du plugin. Parsing défensif — tout est
// optionnel.
export interface PluginManifest {
  description?: string | null;
  version?: string | null;
  keywords?: string[] | null;
  homepage?: string | null;
  license?: string | null;
}

// --- Query Keys ---

export const marketplaceKeys = {
  all: ["marketplace"] as const,
  plugins: (kind?: string, status?: string, search?: string) =>
    ["marketplace", "plugins", { kind, status, search }] as const,
  pluginDetail: (id: number) => ["marketplace", "plugin", id] as const,
  installations: (status?: string, pluginId?: number) =>
    ["marketplace", "installations", { status, pluginId }] as const,
};

// --- Lecture ---

export function useMarketplacePlugins(kind?: string, status?: string, search?: string) {
  return useQuery({
    queryKey: marketplaceKeys.plugins(kind, status, search),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params["label.contains"] = search;
      if (kind) params["kind.equals"] = kind;
      if (status) params["status.equals"] = status;
      const { data } = await axiosClient.get<MarketplacePlugin[]>(
        "/api/marketplace-plugins",
        { params },
      );
      return data;
    },
  });
}

export function useMarketplacePlugin(id: number | null) {
  return useQuery({
    queryKey: id ? marketplaceKeys.pluginDetail(id) : ["marketplace", "plugin", "none"],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<MarketplacePlugin>(
        `/api/marketplace-plugins/${id}`,
      );
      return data;
    },
  });
}

export function useMarketplaceInstallations(status?: string, pluginId?: number) {
  return useQuery({
    queryKey: marketplaceKeys.installations(status, pluginId),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status) params["status.equals"] = status;
      if (pluginId) params["pluginId.equals"] = String(pluginId);
      const { data } = await axiosClient.get<MarketplaceInstallation[]>(
        "/api/marketplace-installations",
        { params },
      );
      return data;
    },
  });
}

// --- Mutations ---

// Installe un plugin pour un tenant : crée une MarketplaceInstallation via POST.
// Le backend exige tenant (@NotNull) et plugin (@NotNull) dans le corps. On envoie
// le statut "installed" et la date d'installation courante.
export function useInstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pluginId: number; tenantId: number }) => {
      const body = {
        status: "installed",
        installedAt: new Date().toISOString(),
        tenant: { id: input.tenantId },
        plugin: { id: input.pluginId },
      };
      const { data } = await axiosClient.post<MarketplaceInstallation>(
        "/api/marketplace-installations",
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.all }),
  });
}

// Désinstalle un plugin : supprime l'installation par son id (soft/hard côté backend).
export function useUninstallPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (installationId: number) => {
      await axiosClient.delete(`/api/marketplace-installations/${installationId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.all }),
  });
}

// --- Utilitaire de parsing du manifest ---

// Parse défensivement le manifest @Lob. Renvoie un objet vide si le manifest est
// absent ou mal formé — la page affiche alors des fallbacks gracieux.
export function parsePluginManifest(raw: string | null | undefined): PluginManifest {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<PluginManifest>;
    return {
      description: parsed.description ?? null,
      version: parsed.version ?? null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : null,
      homepage: parsed.homepage ?? null,
      license: parsed.license ?? null,
    };
  } catch {
    return {};
  }
}