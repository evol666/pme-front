import { libelleTrancheEffectif } from "@/lib/trancheEffectif";
import type { Identite } from "@/api/entreprises";

// Fonctions pures de la fiche entreprise : classes CSS dérivées d'un état,
// formatage et extraction de messages d'erreur. Regroupées ici pour que les
// panneaux d'onglets restent lisibles et testables séparément.

// Couleur du bandeau d'en-tête selon la sévérité du scoring — table de
// correspondance plutôt que ternaires imbriquées.
export function bandeauSeverityClass(scoring: { severity?: string } | null | undefined): string {
	if (scoring?.severity === "faible") return "bg-emerald-500";
	if (scoring?.severity === "modéré") return "bg-amber-400";
	if (scoring) return "bg-red-500";
	return "bg-muted";
}

// Couleurs du badge de score selon la sévérité — table de correspondance
// plutôt que ternaires imbriquées.
export function scoreBadgeSeverityClass(severity: string | undefined): string {
	if (severity === "faible") return "bg-emerald-500/10 text-emerald-600";
	if (severity === "modéré") return "bg-amber-500/10 text-amber-500";
	return "bg-red-500/10 text-red-500";
}

// Couleurs du badge de priorité d'une recommandation — table de
// correspondance plutôt que ternaires imbriquées.
export function recommandationPriorityClass(priority: number): string {
	if (priority <= 2) return "bg-red-500/10 text-red-600";
	if (priority <= 4) return "bg-amber-500/10 text-amber-600";
	return "bg-muted text-muted-foreground";
}


export function extractDiagnosticError(err: unknown): string {
	const axiosErr = err as {
		response?: { data?: { error?: { message?: string } }; statusText?: string };
	};
	return (
		axiosErr?.response?.data?.error?.message ??
		axiosErr?.response?.statusText ??
		"Le diagnostic consultant n'est pas disponible pour le moment."
	);
}

export function fmtEuros(val: number | null | undefined): string {
	if (val == null) return "—";
	if (Math.abs(val) >= 1_000_000)
		return `${(val / 1_000_000).toFixed(2).replace(".", ",")}M €`;
	if (Math.abs(val) >= 1_000)
		return `${Math.round(val / 1_000)}K €`;
	return `${val.toLocaleString("fr-FR")} €`;
}

export function extractModuleError(err: unknown): string {
	const e = err as {
		response?: { data?: { error?: { message?: string } } | string };
		message?: string;
	};
	const fromData = e?.response?.data;
	if (fromData && typeof fromData === "object" && fromData.error?.message) {
		return fromData.error.message;
	}
	if (typeof fromData === "string" && fromData) return fromData;
	return e?.message ?? "Une erreur est survenue.";
}

// Construit le contexte entreprise injecté au prompt (texte libre lisible par l'IA).
export function buildContexteEntreprise(
	identite: Identite,
	raisonSociale: string,
	siren: string,
	metier: { nom_metier?: string } | null | undefined,
): string {
	const lignes = [`Entreprise : ${raisonSociale}`, `SIREN : ${siren}`];
	if (identite.code_naf) {
		const libelleSuffix = identite.libelle_naf
			? ` — ${identite.libelle_naf}`
			: "";
		lignes.push(`Code NAF : ${identite.code_naf}${libelleSuffix}`);
	}
	if (identite.ville) lignes.push(`Ville : ${identite.ville}`);
	if (identite.effectif_tranche)
		lignes.push(`Effectif : ${libelleTrancheEffectif(identite.effectif_tranche)}`);
	if (identite.effectif_estime != null)
		lignes.push(`Effectif estimé : ${identite.effectif_estime}`);
	if (metier?.nom_metier) lignes.push(`Métier détecté : ${metier.nom_metier}`);
	return lignes.join("\n");
}

export function downloadModuleMarkdown(markdown: string, filename: string): void {
	const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

