import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosClient from "@/api/axiosClient";

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
	status: string;
	createdAt: string;
	expiresAt: string | null;
	dismissedAt: string | null;
	acceptedAt: string | null;
	tenant: { id: number } | null;
	user: { id: number } | null;
}

// Feedback possible sur une recommandation (aligné sur l'ancien front).
export type RecommendationFeedback = "seen" | "accepted" | "dismissed";

// --- Diagnostic consultant contextuel (Lot C — POST /contextual) ---
// Wire backend en camelCase (ObjectMapper LOWER_CAMEL_CASE + records Java).

export interface ConsultantActionPrioritaire {
	titre: string;
	description: string;
	duree: string;
	promptIA: string;
}

export interface ConsultantKpi {
	label: string;
	valeur: number;
	tendance: string;
	interpretation: string;
	recommandation: string;
}

export interface ConsultantPlanEtape {
	titre: string;
	statut: string;
	echeance: string;
	impact: string;
	cta: string;
	messageIA: string | null;
}

export interface ConsultantScenario {
	opportunites: number;
	visibilite: number;
	pipelineEtat: string;
}

export interface ConsultantProjection {
	visibiliteAvant: number;
	avecAction: ConsultantScenario;
	sansAction: ConsultantScenario;
}

export interface PmeConsultantData {
	metierId: string;
	diagnostic: string;
	scoreGlobal: number;
	scorePrecedent: number;
	actionPrioritaireDefault: ConsultantActionPrioritaire;
	kpis: ConsultantKpi[];
	plan: ConsultantPlanEtape[];
	projection: ConsultantProjection;
}

export interface ContextualDiagnosticRequest {
	siren: string;
	jobId?: string;
	metierId?: string;
}

export interface ContextualDiagnosticResponse {
	siren: string;
	metierId: string;
	diagnostic: PmeConsultantData;
	actionPrioritaire: AiRecommendation;
}

// --- Query Keys ---

export const recommandationsKeys = {
	all: ["recommandations"] as const,
	list: (jobId?: string) => ["recommandations", "list", { jobId }] as const,
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

// Recommandations scopées à une entreprise : on passe la liste des jobId de ses
// analyses (jobId.in). Sans job, aucune recommandation.
export function useRecommandationsForJobs(jobIds: string[]) {
	const ids = [...jobIds].filter(Boolean).sort((a, b) => a.localeCompare(b));
	return useQuery({
		queryKey: ["recommandations", "byJobs", ids] as const,
		enabled: ids.length > 0,
		queryFn: async () => {
			const { data } = await axiosClient.get<AiRecommendation[]>(
				"/api/ai-recommendations",
				{ params: { "jobId.in": ids.join(",") } },
			);
			return data;
		},
	});
}

export function useRecommandation(id: number | null | undefined) {
	return useQuery({
		queryKey: id
			? recommandationsKeys.detail(id)
			: ["recommandations", "detail", "none"],
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
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: recommandationsKeys.all }),
	});
}

// Diagnostic consultant contextuel (Lot C) : génère un diagnostic déterministe
// orienté métier + persiste l'action prioritaire comme une recommandation active.
// Mutation à la demande (l'utilisateur clique « Générer le diagnostic » dans
// l'onglet Analyses). Invalide le cache recommandations pour faire remonter
// l'action prioritaire persistée dans le CRUD existant.
export function useContextualDiagnostic() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (request: ContextualDiagnosticRequest) => {
			const { data } = await axiosClient.post<ContextualDiagnosticResponse>(
				"/api/ai-recommendations/contextual",
				request,
			);
			return data;
		},
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: recommandationsKeys.all }),
	});
}
