import { Building2, CheckCircle2 } from "lucide-react";
import type { ScoreAxe } from "@/api/entreprises";
import { libelleTrancheEffectif } from "@/lib/trancheEffectif";
import { cn } from "@/lib/utils";

// Briques d'affichage de l'identité et du scoring, réutilisées par l'onglet
// Identité et par l'en-tête de la fiche.

export function StatusBadge({ statut }: { readonly statut: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
				statut === "actif"
					? "bg-emerald-500/10 text-emerald-600"
					: "bg-amber-500/10 text-amber-600",
			)}
		>
			<CheckCircle2 className="w-3 h-3" />
			{statut === "actif" ? "Actif" : "Cessé"}
		</span>
	);
}

const AXE_LABELS: Record<string, string> = {
	stabilite: "Stabilité",
	croissance: "Croissance",
	risque: "Risque",
	maturite_naf: "Maturité NAF",
	solidite_dirigeants: "Dirigeants",
};

export function AxeRow({ axeKey, axe }: { readonly axeKey: string; readonly axe: ScoreAxe }) {
	let barColor = "bg-red-400";
	if (axe.score >= 70) barColor = "bg-emerald-500";
	else if (axe.score >= 40) barColor = "bg-amber-400";

	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-foreground w-32 flex-shrink-0">
				{AXE_LABELS[axeKey] ?? axeKey}
			</span>
			<div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
				<div
					className={cn("h-full rounded-full", barColor)}
					style={{ width: `${axe.score}%` }}
				/>
			</div>
			<span className="text-xs font-bold text-foreground w-7 text-right">
				{axe.score}
			</span>
		</div>
	);
}

export function IdentiteCard({
	identite,
}: {
	readonly identite: import("@/api/entreprises").Identite;
}) {
	const rows = [
		{
			label: "Forme jur.",
			value: identite.forme_juridique_libelle ?? identite.forme_juridique,
		},
		{
			label: "Effectif",
			value: libelleTrancheEffectif(identite.effectif_tranche),
		},
		{ label: "Catégorie", value: identite.categorie },
		{ label: "Risque NAF", value: identite.risque_sectoriel },
		{ label: "Dept.", value: identite.departement },
	].filter((r) => r.value);

	return (
		<div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
			<div className="flex items-center gap-2 mb-3">
				<Building2 className="w-4 h-4 text-primary" />
				<h2 className="text-sm font-bold">Identité</h2>
			</div>
			<dl className="space-y-2">
				{rows.map((r) => (
					<div key={r.label} className="flex justify-between gap-2 text-xs">
						<dt className="text-muted-foreground">{r.label}</dt>
						<dd className="font-semibold text-foreground text-right truncate">
							{r.value}
						</dd>
					</div>
				))}
			</dl>
			{identite.convention_collective && (
				<p className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground line-clamp-2">
					📋 {identite.convention_collective}
				</p>
			)}
		</div>
	);
}
