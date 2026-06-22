import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Bundles (LOT "Studio") — version Spring Boot CRUD uniquement.
// Backend : StudioBundleResource (/api/studio-bundles). L'endpoint catalogue
// `/api/bundles/catalog` (vue résumée FastAPI, BundleSummaryDTO) n'existe pas côté
// Spring Boot — la page reconstruit la vue catalogue côté client depuis le CRUD
// (liste + filtres Criteria + manifest @Lob parsé). Voir [[pme-migration-fastapi-only-endpoints]].

// DTOs Spring Boot en camelCase (naming strategy Jackson standard). Le champ
// `manifest` est @Lob : une chaîne JSON sérialisée (description, version, keywords,
// asset_counts… selon le schéma du bundle).

export interface TenantRef {
  id: number;
}

export interface StudioProjectRef {
  id: number;
  title: string;
  status: string; // StudioProjectStatus enum, sérialisé en name uppercase
  targetMetier: string | null;
}

export interface StudioBundle {
  id: number;
  name: string;
  metierSlug: string;
  isActive: boolean;
  manifest: string | null; // @Lob : chaîne JSON
  createdAt: string;
  project: StudioProjectRef;
  tenant: TenantRef;
}

// Champs optionnels extraits du manifest JSON (présents si le bundle a été généré
// avec un manifest riche). Parsing défensif — tout est optionnel.
export interface BundleManifest {
  description?: string | null;
  version?: string | null;
  keywords?: string[] | null;
  asset_counts?: Record<string, number> | null;
  metier_ids?: string[] | null;
}

// --- Query Keys ---

export const bundlesKeys = {
  all: ["bundles"] as const,
  list: (nameContains?: string, isActive?: boolean) =>
    ["bundles", "list", { nameContains, isActive }] as const,
  detail: (id: number) => ["bundles", "detail", id] as const,
};

// --- Lecture ---

export function useBundles(nameContains?: string, isActive?: boolean) {
  return useQuery({
    queryKey: bundlesKeys.list(nameContains, isActive),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (nameContains) params["name.contains"] = nameContains;
      if (isActive !== undefined) params["isActive.equals"] = String(isActive);
      const { data } = await axiosClient.get<StudioBundle[]>("/api/studio-bundles", {
        params,
      });
      return data;
    },
  });
}

export function useBundle(id: number | null) {
  return useQuery({
    queryKey: id ? bundlesKeys.detail(id) : ["bundles", "detail", "none"],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioBundle>(`/api/studio-bundles/${id}`);
      return data;
    },
  });
}

// --- Mutations ---

// Activation/désactivation d'un bundle : PATCH merge-patch avec isActive basculé.
// Le backend exige un id non null dans le corps (partialUpdate vérifie getId()).
export function useToggleBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const { data } = await axiosClient.patch<StudioBundle>(
        `/api/studio-bundles/${id}`,
        { id, isActive },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: bundlesKeys.all }),
  });
}

export function useDeleteBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-bundles/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: bundlesKeys.all }),
  });
}

// --- Utilitaire de parsing du manifest ---

// Parse défensivement le manifest @Lob. Renvoie un objet vide si le manifest est
// absent ou mal formé — la page affiche alors des fallbacks gracieux.
export function parseBundleManifest(raw: string | null | undefined): BundleManifest {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<BundleManifest>;
    return {
      description: parsed.description ?? null,
      version: parsed.version ?? null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : null,
      asset_counts:
        parsed.asset_counts && typeof parsed.asset_counts === "object"
          ? parsed.asset_counts
          : null,
      metier_ids: Array.isArray(parsed.metier_ids) ? parsed.metier_ids : null,
    };
  } catch {
    return {};
  }
}