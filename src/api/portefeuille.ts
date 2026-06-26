import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Portefeuille d'entreprises suivies.
// Stocké via BusinessEntity (kind = type de relation, externalRef = SIREN,
// attributes = JSON résumé enrichissement).
// ---------------------------------------------------------------------------

export const RELATION_TYPES = [
  { value: "client",      label: "Client",      color: "emerald" },
  { value: "prospect",    label: "Prospect",    color: "blue" },
  { value: "partenaire",  label: "Partenaire",  color: "violet" },
  { value: "concurrent",  label: "Concurrent",  color: "amber" },
  { value: "fournisseur", label: "Fournisseur", color: "orange" },
] as const;

export type RelationType = typeof RELATION_TYPES[number]["value"];

export interface EntreprisePortefeuille {
  id: number;
  siren: string;
  label: string;          // raison sociale
  kind: RelationType;
  notes: string | null;
  // champs dénormalisés depuis l'enrichissement (stockés dans attributes JSON)
  codeNaf: string | null;
  libelleNaf: string | null;
  ville: string | null;
  score: number | null;
  severity: string | null;
  statut: string | null;
  effectifTranche: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawBusinessEntity {
  id: number;
  kind: string;
  externalRef: string | null;
  label: string;
  attributes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Convertit un BusinessEntity brut en EntreprisePortefeuille
function toPortefeuille(e: RawBusinessEntity): EntreprisePortefeuille | null {
  if (!e.externalRef || !/^\d{9}$/.test(e.externalRef)) return null;
  let attrs: Record<string, unknown> = {};
  try { if (e.attributes) attrs = JSON.parse(e.attributes); } catch { /* JSON invalide — on ignore */ }
  return {
    id:              e.id,
    siren:           e.externalRef,
    label:           e.label,
    kind:            e.kind as RelationType,
    notes:           (attrs.notes as string) ?? null,
    codeNaf:         (attrs.codeNaf as string) ?? null,
    libelleNaf:      (attrs.libelleNaf as string) ?? null,
    ville:           (attrs.ville as string) ?? null,
    score:           typeof attrs.score === "number" ? attrs.score : null,
    severity:        (attrs.severity as string) ?? null,
    statut:          (attrs.statut as string) ?? null,
    effectifTranche: (attrs.effectifTranche as string) ?? null,
    createdAt:       e.createdAt,
    updatedAt:       e.updatedAt,
  };
}

function toAttributes(data: Partial<EntreprisePortefeuille>): string {
  return JSON.stringify({
    notes:           data.notes           ?? null,
    codeNaf:         data.codeNaf         ?? null,
    libelleNaf:      data.libelleNaf      ?? null,
    ville:           data.ville           ?? null,
    score:           data.score           ?? null,
    severity:        data.severity        ?? null,
    statut:          data.statut          ?? null,
    effectifTranche: data.effectifTranche ?? null,
  });
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const portefeuilleKeys = {
  all:    ["portefeuille"] as const,
  list:   (kind?: string) => ["portefeuille", "list", kind ?? "all"] as const,
  detail: (siren: string) => ["portefeuille", "detail", siren] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Liste toutes les entreprises du portefeuille (optionnellement filtrée par type). */
export function usePortefeuille(kind?: RelationType) {
  return useQuery({
    queryKey: portefeuilleKeys.list(kind),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (kind) params["kind.equals"] = kind;
      const { data } = await axiosClient.get<RawBusinessEntity[]>(
        "/api/business-entities",
        { params },
      );
      // Filtrer uniquement les entités avec un SIREN valide
      return data
        .map(toPortefeuille)
        .filter((e): e is EntreprisePortefeuille => e !== null)
        .filter((e) => RELATION_TYPES.some((r) => r.value === e.kind));
    },
  });
}

/** Récupère une entreprise du portefeuille par SIREN. */
export function usePortefeuilleEntreprise(siren: string | null | undefined) {
  return useQuery({
    queryKey: siren ? portefeuilleKeys.detail(siren) : ["portefeuille", "detail", "none"],
    enabled: !!siren,
    queryFn: async () => {
      const { data } = await axiosClient.get<RawBusinessEntity[]>(
        "/api/business-entities",
        { params: { "externalRef.equals": siren } },
      );
      const found = data.map(toPortefeuille).find((e) => e !== null && e.siren === siren);
      return found ?? null;
    },
  });
}

export interface AddEntrepriseInput {
  siren: string;
  label: string;
  kind: RelationType;
  notes?: string;
  // enrichissement summary
  codeNaf?: string | null;
  libelleNaf?: string | null;
  ville?: string | null;
  score?: number | null;
  severity?: string | null;
  statut?: string | null;
  effectifTranche?: string | null;
}

/** Ajoute une entreprise au portefeuille. */
export function useAddEntreprise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddEntrepriseInput) => {
      const { data } = await axiosClient.post<RawBusinessEntity>(
        "/api/business-entities",
        {
          kind:        input.kind,
          externalRef: input.siren,
          label:       input.label,
          attributes:  toAttributes(input),
        },
      );
      return toPortefeuille(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portefeuilleKeys.all }),
  });
}

export interface UpdateEntrepriseInput {
  id: number;
  kind?: RelationType;
  notes?: string | null;
  label?: string;
}

/** Met à jour le type de relation ou les notes d'une entreprise. */
export function useUpdateEntreprise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kind, notes, label }: UpdateEntrepriseInput) => {
      // Charger l'entité existante d'abord pour préserver attributes
      const { data: existing } = await axiosClient.get<RawBusinessEntity>(
        `/api/business-entities/${id}`,
      );
      let attrs: Record<string, unknown> = {};
      try { if (existing.attributes) attrs = JSON.parse(existing.attributes); } catch { /* JSON invalide — on ignore */ }
      if (notes !== undefined) attrs.notes = notes;

      const { data } = await axiosClient.put<RawBusinessEntity>(
        `/api/business-entities/${id}`,
        {
          ...existing,
          kind:       kind ?? existing.kind,
          label:      label ?? existing.label,
          attributes: JSON.stringify(attrs),
        },
      );
      return toPortefeuille(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portefeuilleKeys.all }),
  });
}

/** Supprime une entreprise du portefeuille. */
export function useRemoveEntreprise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/business-entities/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portefeuilleKeys.all }),
  });
}
