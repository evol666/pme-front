import { useMutation, useQuery } from "@tanstack/react-query";
import axiosClient from "@/api/axiosClient";

// Hooks API pour le flux « module métier → livrable » (Lot B du PLAN_PARITE).
// Backend Spring Boot :
//   - MetiersResource        (/api/pme/metiers)        — référentiel + détection NAF
//   - ModuleExecuteResource  (/api/pme/execute)        — exécution module → markdown
//
// Wire backend : les records Java utilisent @JsonProperty en snake_case pour les
// champs composés (nom_metier, code_naf, mots_cles, prompt_associe, prompts_dossier,
// type_entite, effectif_typique, indices_classification). Le record ExecuteRequest
// expose ses composants en snake_case (metier_id, prompt_id, contexte_entreprise) :
// Jackson les sérialise tels quels (LOWER_CAMEL_CASE ne transforme pas l'existant).
// Aucune conversion de cas côté front — on envoie du snake_case pour matcher le
// record backend, comme attendu par ModuleExecuteResource.
//
// Prérequis §1.4 du PLAN_PARITE : la bibliothèque de prompts (PROMPT_LIBRARY_PATH)
// et le service IA (AI_CHATBOT_URL) doivent être joignables. Sans eux, l'exécution
// renvoie 422 (prompt introuvable) ou 502 (IA down) — le front gère ces cas.

// --- Types (match exact avec le wire backend) ---

export interface PmeMetierDTO {
	id: string;
	nom_metier: string;
	code_naf: string[] | null;
	secteur: string | null;
	description: string | null;
	mots_cles: string[] | null;
	prompt_associe: string | null;
	prompts_dossier: string | null;
	icone: string | null;
	type_entite: string | null;
	effectif_typique: string | null;
	indices_classification: string | null;
}

export interface ExecuteModuleRequest {
	metier_id: string;
	prompt_id: string;
	contexte_entreprise: string;
	preferences?: Record<string, unknown>;
}

// Le backend renvoie Map<String, Object> brute (sortie du chatbot Python). On
// extrait best-effort le markdown et le meta ; les clés supplémentaires sont
// ignorées. `markdown` peut venir sous `markdown` ou `content` selon le chatbot.
export interface ExecuteModuleResponse {
	markdown: string;
	meta: Record<string, unknown> | null;
}

// --- Query Keys ---

export const modulesKeys = {
	all: ["modules"] as const,
	detect: (codeNaf: string) => ["modules", "detect", codeNaf] as const,
};

// --- Hooks ---

// Résout le métier depuis un code NAF (ex. "45.20Z"). Renvoie null si le backend
// répond 404 (NAF non couvert par le référentiel) — on ne remonte pas l'erreur
// pour ne pas casser l'onglet : l'UI retombe sur le profil "generique".
export function useDetectMetier(codeNaf: string | null | undefined) {
	return useQuery({
		queryKey: codeNaf
			? modulesKeys.detect(codeNaf)
			: ["modules", "detect", "none"],
		enabled: !!codeNaf,
		retry: false,
		queryFn: async () => {
			try {
				const { data } = await axiosClient.get<PmeMetierDTO>(
					`/api/pme/metiers/naf/${encodeURIComponent(codeNaf as string)}`,
				);
				return data;
			} catch (err: unknown) {
				const status = (err as { response?: { status?: number } })?.response
					?.status;
				// 404 = NAF non couvert : cas normal, on retourne null (fallback generique).
				if (status === 404) return null;
				throw err;
			}
		},
	});
}

// Exécute un module métier → livrable markdown. La mutation n'invalide aucun
// cache par défaut : l'appelant décide s'il archive le livrable (Documents)
// et invalide alors les queries documents via useUploadDocumentDirect.
// Extrait le contenu markdown de la réponse — le backend peut renvoyer le
// texte sous l'une de ces trois clés selon le module exécuté.
function extractExecuteMarkdown(data: Record<string, unknown> | undefined): string {
	if (typeof data?.markdown === "string") return data.markdown;
	if (typeof data?.content === "string") return data.content;
	if (typeof data?.text === "string") return data.text;
	return "";
}

export function useExecuteModule() {
	return useMutation({
		mutationFn: async (request: ExecuteModuleRequest) => {
			const { data } = await axiosClient.post<Record<string, unknown>>(
				"/api/pme/execute",
				request,
			);
			const markdown = extractExecuteMarkdown(data);
			const meta =
				data?.meta && typeof data.meta === "object" && !Array.isArray(data.meta)
					? (data.meta as Record<string, unknown>)
					: null;
			return { markdown, meta } satisfies ExecuteModuleResponse;
		},
	});
}
