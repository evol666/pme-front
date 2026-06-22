import axiosClient from "@/api/axiosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Hooks API pour les recommandations IA.
// Backend Spring Boot : AiRecommendationResource (/api/ai-recommendations), CRUD
// JHipster standard. Réponses en camelCase. Les recommandations sont générées lors
// de l'analyse (consumer Kafka) puis mises en cache ; on les liste par job_id.
//
// NOTE : l'ancien frontend FastAPI exposait /api/recommendations/contextual et
// /api/recommendations/actions (génération contextuelle + catalogue d'actions).
// Ces endpoints n'existent pas dans le backend Spring Boot — génération et catalog
// sont à recréer côté backend avant de migrer ces flows. On couvre ici le CRUD du
// cache (list / détail / feedback = update status).

// --- Types (match exact avec le wire backend, camelCase) ---

export type RecommendationStatus = string;

export interface AiRecommendation {
  id: number;
  jobId: string | null;
  metierId: string | null;
  action: string;
  category: string | null;
  priority: number;
  score: number;
  confidence: number;
  title: string | null;
  rationale: string | null;
  reasons: string | null;
  sources: string | null;
  payload: string | null;
  status: RecommendationStatus;
  createdAt: string;
  expiresAt: string | null;
  dismissedAt: string | null;
  acceptedAt: string | null;
  tenant: { id: number } | null;
  user: { id: number } | null;
}

// Feedback possible sur une recommandation (aligné sur l'ancien front).
export type RecommendationFeedback = "seen" | "accepted" | "dismissed";

// --- Query Keys ---

export const recommandationsKeys = {
  all: ["recommandations"] as const,
  list: (jobId?: string) =>
    ["recommandations", "list", { jobId }] as const,
  detail: (id: number) => ["recommandations", "detail", id] as const,
};

// --- Hooks ---

export function useRecommandations(jobId?: string) {
  return useQuery({
    queryKey: recommandationsKeys.list(jobId),
    queryFn: async () => {
      // Critère JHipster : jobId.equals=<value>. Sans jobId on remonte tout.
      const params = jobId ? { "jobId.equals": jobId } : undefined;
      const { data } = await axiosClient.get<AiRecommendation[]>(
        "/api/ai-recommendations",
        { params },
      );
      return data;
    },
  });
}

export function useRecommandation(id: number | null | undefined) {
  return useQuery({
    queryKey: id ? recommandationsKeys.detail(id) : ["recommandations", "detail", "none"],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<AiRecommendation>(
        `/api/ai-recommendations/${id}`,
      );
      return data;
    },
  });
}

// Feedback = mise à jour du statut (+ horodatage). PATCH partiel JHipster : on
// renvoie l'id + les champs modifiés, les champs null sont ignorés côté backend.
export function useRecommandationFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: number;
      feedback: RecommendationFeedback;
    }) => {
      const now = new Date().toISOString();
      const body: Partial<AiRecommendation> & { id: number } = {
        id: params.id,
        status: params.feedback,
      };
      if (params.feedback === "accepted") body.acceptedAt = now;
      if (params.feedback === "dismissed") body.dismissedAt = now;
      const { data } = await axiosClient.patch<AiRecommendation>(
        `/api/ai-recommendations/${params.id}`,
        body,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recommandationsKeys.all }),
  });
}