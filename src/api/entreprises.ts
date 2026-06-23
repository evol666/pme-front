import axiosClient from "@/api/axiosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types — correspondent aux DTOs de EntrepriseResource.java
// ---------------------------------------------------------------------------

export interface EntrepriseSearchResult {
  siren: string;
  nomAffichage: string;
  raisonSociale: string;
  codeNaf: string;
  etat: string; // "A" | "C"
  categorie: string; // "PME" | "ETI" | "GE" | ""
  trancheEffectif: string;
  dateCreation: string;
}

export interface EntrepriseSearchResponse {
  total: number;
  page: number;
  size: number;
  results: EntrepriseSearchResult[];
}

// Identité — sous-objet du JSON enrichi
export interface Dirigeant {
  type: string;
  nom: string | null;
  prenoms: string | null;
  qualite: string;
  date_naissance: string | null;
  nationalite: string | null;
}

export interface Identite {
  siren: string;
  siret_siege: string | null;
  raison_sociale: string | null;
  enseigne: string | null;
  forme_juridique: string | null;
  forme_juridique_libelle: string | null;
  statut: string;
  date_creation: string | null;
  date_radiation: string | null;
  code_naf: string | null;
  libelle_naf: string | null;
  section_naf: string | null;
  effectif_tranche: string | null;
  effectif_annee: string | null;
  effectif_estime: number | null;
  capital_social: number | null;
  categorie: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  departement: string | null;
  region: string | null;
  nb_etablissements_ouverts: number | null;
  dirigeants: Dirigeant[];
  convention_collective: string | null;
  risque_sectoriel: string | null;
  source: string;
}

export interface BodaccSignal {
  date: string;
  type: string;
  famille: string;
  tribunal: string;
  departement: string;
  numero: string;
  contenu: string;
}

export interface BodaccData {
  evenements: BodaccSignal[];
  signaux: {
    total: number;
    risque: number;
    croissance: number;
    evenements_risque: BodaccSignal[];
    evenements_croissance: BodaccSignal[];
  };
}

export interface Geolocalisation {
  latitude: number;
  longitude: number;
  score: number;
  label: string;
  code_insee: string;
  departement: string;
}

export interface ScoreAxe {
  score: number;
  poids: number;
  raisons: string[];
}

export interface Scoring {
  score_global: number;
  severity: "faible" | "modéré" | "élevé";
  axes: {
    stabilite: ScoreAxe;
    croissance: ScoreAxe;
    risque: ScoreAxe;
    maturite_naf: ScoreAxe;
    solidite_dirigeants: ScoreAxe;
  };
}

export interface Synthese {
  texte: string;
  points_cles: {
    raison_sociale: string;
    activite: string;
    ville: string;
    anciennete_ans: number;
    effectif: string;
    statut: string;
    risque_sectoriel: string;
    signaux_bodacc_risque: number;
    signaux_bodacc_croissance: number;
    score: number;
  };
}

export interface EntrepriseEnrichie {
  siren: string;
  enriched_at: string;
  offline_sources: string[];
  identite: Identite;
  bodacc: BodaccData;
  geolocalisation: Geolocalisation | null;
  scoring: Scoring;
  synthese: Synthese;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const entreprisesKeys = {
  all: ["entreprises"] as const,
  search: (q: string, page: number) =>
    ["entreprises", "search", q, page] as const,
  detail: (siren: string) => ["entreprises", "detail", siren] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Recherche par nom ou SIREN (min 2 caractères).
 * enabled automatiquement dès que q.length >= 2.
 */
export function useEntrepriseSearch(q: string, page = 0, size = 10) {
  return useQuery({
    queryKey: entreprisesKeys.search(q, page),
    enabled: q.trim().length >= 2,
    staleTime: 30_000, // 30s — les résultats Sirene sont stables
    queryFn: async () => {
      const { data } = await axiosClient.get<EntrepriseSearchResponse>(
        "/api/entreprises/search",
        { params: { q: q.trim(), page, size } },
      );
      return data;
    },
  });
}

/**
 * Fiche enrichie d'un SIREN (cache backend 24h + cache TanStack 5min).
 */
export function useEntreprise(siren: string | null | undefined) {
  return useQuery({
    queryKey: siren ? entreprisesKeys.detail(siren) : ["entreprises", "detail", "none"],
    enabled: !!siren && /^\d{9}$/.test(siren),
    staleTime: 5 * 60_000, // 5 minutes côté front (backend cache 24h)
    queryFn: async () => {
      const { data } = await axiosClient.get<EntrepriseEnrichie>(
        `/api/entreprises/${siren}`,
      );
      return data;
    },
  });
}

/**
 * Force le re-enrichissement (invalide le cache backend puis refetch).
 */
export function useRefreshEntreprise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (siren: string) => {
      const { data } = await axiosClient.post<EntrepriseEnrichie>(
        `/api/entreprises/${siren}/refresh`,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(entreprisesKeys.detail(data.siren), data);
    },
  });
}
