import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API pour l'import de la base Sirene (INSEE / data.gouv.fr).
// Backend : EntrepriseResource
//   - POST /api/sirene/import          (ROLE_ADMIN) -> démarre l'import async
//   - GET  /api/sirene/import/status   (ROLE_ADMIN) -> progression
//   - GET  /api/sirene/stats           -> comptes base locale

export interface SireneImportStatus {
  running: boolean;
  phase: "idle" | "downloading" | "parsing" | "done" | "error";
  processed: number;
  upserted: number;
  skipped: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SireneStats {
  actives: number;
  cessees: number;
  total: number;
}

export const sireneKeys = {
  status: ["sirene", "status"] as const,
  stats: ["sirene", "stats"] as const,
};

/** Progression de l'import — poll toutes les 3 s tant qu'un import tourne. */
export function useSireneImportStatus(enabled = true) {
  return useQuery({
    queryKey: sireneKeys.status,
    queryFn: async () => {
      const { data } = await axiosClient.get<SireneImportStatus>("/api/sirene/import/status");
      return data;
    },
    enabled,
    refetchInterval: (query) =>
      query.state.data?.running ? 3000 : false,
  });
}

/** Comptes de la base Sirene locale. */
export function useSireneStats() {
  return useQuery({
    queryKey: sireneKeys.stats,
    queryFn: async () => {
      const { data } = await axiosClient.get<SireneStats>("/api/sirene/stats");
      return data;
    },
  });
}

/** Démarre l'import Sirene (ADMIN). */
export function useStartSireneImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.post<{ message: string }>("/api/sirene/import");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sireneKeys.status });
    },
  });
}
