import { useQuery } from "@tanstack/react-query";
import axiosClient from "@/api/axiosClient";

// Hooks API pour le référentiel métiers PME.
// Backend Spring Boot : MetiersResource (/api/pme/metiers). Les records Java sont
// sérialisés via la stratégie LOWER_CAMEL_CASE de Jackson, sauf les composants
// annotés @JsonProperty explicitement en snake_case (metier_id, prompt_id).
// Aucune conversion de cas côté front (cf. axiosClient : seul le path est réécrit
// /api -> /services/pme/api).
//
// Endpoints couverts :
//  - GET /api/pme/metiers/{id}/modules -> catalogue modules + outils du métier
//    (fallback generique, jamais 404).

// --- Types (match exact avec le wire backend) ---

export interface PmeModuleDTO {
	id: string;
	titre: string;
	description: string;
	duree: string;
	categorie: string;
	icone: string;
	prompt: string;
	prompt_id: string | null;
}

export interface PmeToolDTO {
	id: string;
	titre: string;
	description: string;
	duree: string;
	icone: string;
	prompt_id: string | null;
	prompt: string;
}

export interface PmeMetierModulesDTO {
	metier_id: string;
	label: string;
	modules: PmeModuleDTO[];
	tools: PmeToolDTO[];
}

// --- Query Keys ---

export const metiersKeys = {
	all: ["metiers"] as const,
	modules: (metierId: string) => ["metiers", "modules", metierId] as const,
};

// --- Hooks ---

// Catalogue modules + outils d'un métier. L'identifiant peut être un slug de métier
// (ex. "garagiste") ou "generique" par défaut. Le backend ne renvoie jamais 404.
export function useMetierModules(metierId: string | null | undefined) {
	return useQuery({
		queryKey: metierId
			? metiersKeys.modules(metierId)
			: ["metiers", "modules", "none"],
		enabled: !!metierId,
		queryFn: async () => {
			const { data } = await axiosClient.get<PmeMetierModulesDTO>(
				`/api/pme/metiers/${encodeURIComponent(metierId as string)}/modules`,
			);
			return data;
		},
	});
}
