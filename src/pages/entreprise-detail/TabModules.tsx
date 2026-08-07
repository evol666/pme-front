import { Blocks, LayoutGrid, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useAnalyses } from "@/api/analyses";
import { useMetierModules } from "@/api/metiers";
import type { TabId } from "./types";
import { cn } from "@/lib/utils";

// Onglet Modules : catalogue des modules métier détectés pour l'entreprise.

const BUNDLE_PROFILES: { id: string; label: string }[] = [
	{ id: "achats_fournisseurs", label: "Achats & fournisseurs" },
	{ id: "btp", label: "BTP / Construction" },
	{ id: "collectivites", label: "Collectivités / Public" },
	{ id: "consultant", label: "Conseil / Consulting" },
	{ id: "eti_industrie", label: "ETI / Industrie" },
	{ id: "immobilier", label: "Immobilier" },
	{ id: "industrie", label: "Industrie" },
	{ id: "juridique", label: "Juridique" },
	{ id: "recrutement", label: "Recrutement" },
	{ id: "restauration", label: "Restauration" },
	{ id: "retail", label: "Retail / Commerce" },
	{ id: "rh_avance", label: "RH avancé" },
	{ id: "sante", label: "Santé" },
	{ id: "services_personne", label: "Services à la personne" },
];

export function TabModules({
	siren,
	activeModule,
	goTo,
}: {
	readonly siren: string;
	readonly activeModule: string | null;
	readonly goTo: (id: TabId, module?: string) => void;
}) {
	const { data: analyses } = useAnalyses(siren);
	const lastAnalysis = (analyses ?? [])[0];
	// Métier détecté depuis la dernière analyse ; fallback "generique" (le backend
	// ne renvoie jamais 404 sur cet identifiant).
	const detectedId = lastAnalysis?.detected_business_id ?? "generique";
	// Lot H — l'utilisateur peut élargir au secteur (bundle B2B) ; null = métier détecté.
	const [bundleOverride, setBundleOverride] = useState<string | null>(null);
	const metierId = bundleOverride ?? detectedId;
	const { data: catalog, isLoading } = useMetierModules(metierId);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
				<Loader2 className="w-4 h-4 animate-spin" />
				Chargement du catalogue modules…
			</div>
		);
	}

	if (!catalog) {
		return (
			<div className="py-12 text-center text-sm text-muted-foreground">
				Aucun catalogue disponible pour ce métier.
			</div>
		);
	}

	const modules = catalog.modules ?? [];
	const tools = catalog.tools ?? [];
	const selected = activeModule
		? modules.find((m) => m.id === activeModule)
		: null;

	return (
		<div className="space-y-5">
			<div>
				<p className="text-sm font-semibold text-foreground flex items-center gap-2">
					<LayoutGrid className="w-4 h-4 text-primary" />
					Modules & outils — {catalog.label ?? metierId}
				</p>
				<p className="text-xs text-muted-foreground mt-1">
					Actions guidées par IA pour le métier détecté. Lancées depuis la fiche
					entreprise, elles nourrissent analyses et recommandations.
				</p>
				<div className="mt-3 flex items-center gap-2">
					<label
						htmlFor="entreprise-bundle-override"
						className="text-xs text-muted-foreground"
					>
						Élargir au secteur :
					</label>
					<select
						id="entreprise-bundle-override"
						value={bundleOverride ?? ""}
						onChange={(e) => setBundleOverride(e.target.value || null)}
						className="text-xs border border-border rounded-md px-2 py-1 bg-card text-foreground"
					>
						<option value="">Métier détecté</option>
						{BUNDLE_PROFILES.map((b) => (
							<option key={b.id} value={b.id}>
								{b.label}
							</option>
						))}
					</select>
				</div>
			</div>

			{modules.length === 0 ? (
				<p className="text-sm text-muted-foreground py-4">
					Aucun module dédié pour ce métier.
				</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{modules.map((m) => {
						const isSelected = selected?.id === m.id;
						return (
							<button
								key={m.id}
								type="button"
								onClick={() => goTo("modules", m.id)}
								className={cn(
									"text-left bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md",
									isSelected
										? "border-primary ring-2 ring-primary/30"
										: "border-border/50",
								)}
							>
								<div className="flex items-start justify-between gap-2">
									<h4 className="text-sm font-bold text-foreground">
										{m.titre}
									</h4>
									{m.duree && (
										<span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
											{m.duree}
										</span>
									)}
								</div>
								{m.categorie && (
									<span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider text-primary">
										{m.categorie}
									</span>
								)}
								<p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
									{m.description}
								</p>
							</button>
						);
					})}
				</div>
			)}

			{selected && (
				<div className="bg-card border border-primary/40 rounded-xl p-5 shadow-sm space-y-2">
					<div className="flex items-start justify-between gap-2">
						<div>
							<h4 className="text-base font-bold text-foreground">
								{selected.titre}
							</h4>
							{selected.categorie && (
								<span className="text-[10px] font-bold uppercase tracking-wider text-primary">
									{selected.categorie}
								</span>
							)}
						</div>
						<button
							type="button"
							onClick={() => goTo("modules", undefined)}
							className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
							title="Fermer"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
					<p className="text-sm text-foreground leading-relaxed">
						{selected.description}
					</p>
					{selected.duree && (
						<p className="text-xs text-muted-foreground">
							Durée estimée : {selected.duree}
						</p>
					)}
					{selected.prompt && (
						<details className="mt-2">
							<summary className="text-xs font-semibold text-primary cursor-pointer">
								Voir le prompt IA
							</summary>
							<pre className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap bg-accent/50 rounded-md p-3">
								{selected.prompt}
							</pre>
						</details>
					)}
				</div>
			)}

			{tools.length > 0 && (
				<div className="space-y-2">
					<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
						<Blocks className="w-3.5 h-3.5" />
						Outils réutilisables
					</h4>
					<ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
						{tools.map((t) => (
							<li
								key={t.id}
								className="bg-card border border-border/50 rounded-lg p-3"
							>
								<p className="text-sm font-semibold text-foreground">
									{t.titre}
								</p>
								<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
									{t.description}
								</p>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
