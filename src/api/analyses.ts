import axiosClient from "@/api/axiosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Hooks API pour le flux d'analyse d'entreprise.
// Backend: CompanyAnalyzeResource (/api/company/analyze). Réponses en snake_case
// (champs backend nommés explicitement en snake_case, pas de naming strategy Jackson).

// --- Types (match exact avec le wire backend) ---

export interface AnalysisJobSummary {
  job_id: string;
  siren: string;
  status: string;
  company_name: string | null;
  detected_business_label: string | null;
  detected_business_id: string | null;
  score: number | null;
  progress: number | null;
  current_step: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export interface AnalysisStatus {
  job_id: string;
  status: string;
  current_step: string | null;
  progress: number | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  company: Record<string, unknown> | null;
  detected_business: Record<string, unknown> | null;
  recommended_tools: Array<Record<string, unknown>> | null;
  workflows: Array<Record<string, unknown>> | null;
  proposal: string | null;
  diagnostic: string | null;
}

export interface LaunchAnalysisRequest {
  siren: string;
  metier_force?: string;
}

export interface LaunchAnalysisAck {
  job_id: string;
  status: string;
}

// --- Query Keys ---

export const analysesKeys = {
  all: ["analyses"] as const,
  list: (siren?: string, limit?: number) =>
    ["analyses", "list", { siren, limit }] as const,
  status: (jobId: string) => ["analyses", "status", jobId] as const,
};

// --- Hooks ---

export function useAnalyses(siren?: string, limit = 50) {
  return useQuery({
    queryKey: analysesKeys.list(siren, limit),
    queryFn: async () => {
      const { data } = await axiosClient.get<AnalysisJobSummary[]>(
        "/api/company/analyze",
        { params: { siren, limit } },
      );
      return data;
    },
  });
}

export function useAnalysisStatus(jobId: string | null | undefined) {
  return useQuery({
    queryKey: jobId ? analysesKeys.status(jobId) : ["analyses", "status", "none"],
    enabled: !!jobId,
    // Le job est asynchrone (Kafka) : on rafraîchit jusqu'à un état terminal.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !["completed", "failed", "error"].includes(status)
        ? 3000
        : false;
    },
    queryFn: async () => {
      const { data } = await axiosClient.get<AnalysisStatus>(
        `/api/company/analyze/${jobId}`,
      );
      return data;
    },
  });
}

export function useLaunchAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: LaunchAnalysisRequest) => {
      const { data } = await axiosClient.post<LaunchAnalysisAck>(
        "/api/company/analyze",
        request,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: analysesKeys.all }),
  });
}