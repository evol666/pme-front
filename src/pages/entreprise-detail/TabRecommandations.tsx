import { LayoutGrid, Lightbulb } from "lucide-react";
import { useAnalyses } from "@/api/analyses";
import type { Identite } from "@/api/entreprises";
import { useMetierModules } from "@/api/metiers";
import { useDetectMetier } from "@/api/modules";
import { useRecommandationsForJobs } from "@/api/recommandations";
import { recommandationPriorityClass } from "./helpers";
import { EmptyTab, LoadingSpinner } from "./etats";
import { ModuleCard } from "./ModuleCard";
import type { CatalogItem } from "./types";
import { cn } from "@/lib/utils";

// Onglet Recommandations : recommandations issues des analyses du SIREN, puis
// catalogue des actions proposées pour le métier détecté.

export function TabRecommandations({
	siren,
	identite,
	onLaunchModule,
}: {
	readonly siren: string;
	readonly identite: Identite;
	readonly onLaunchModule: (item: any) => void;
}) {
	// Recommandations propres à l'entreprise : on récupère les analyses du SIREN,
	// puis les recommandations rattachées à ces jobId.
	const { data: analyses } = useAnalyses(siren);
	const jobIds = (analyses ?? []).map((a) => a.job_id).filter(Boolean);
	const { data: recos, isLoading } = useRecommandationsForJobs(jobIds);

	const filtered = (recos ?? []).slice(0, 20);

	// Section « Actions pour votre métier » (Lot B) : détection NAF → catalogue
	// modules/outils → exécution module → livrable. Fallback "generique" si le
	// NAF n'est pas couvert par le référentiel (useDetectMetier renvoie null).
	const { data: metier } = useDetectMetier(identite.code_naf);
	const metierId = metier?.id ?? "generique";
	const { data: catalogue, isLoading: catLoading } = useMetierModules(metierId);

	const modules = catalogue?.modules ?? [];
	const tools = catalogue?.tools ?? [];

	// Rendu de la section « Actions pour votre métier » — if/else plutôt que
	// ternaires imbriquées.
	const renderMetierActions = () => {
		if (catLoading) return <LoadingSpinner />;
		if (modules.length === 0 && tools.length === 0) {
			return (
				<EmptyTab
					icon={LayoutGrid}
					title="Aucun module disponible pour ce métier"
				/>
			);
		}
		return (
			<>
				{modules.length > 0 && (
					<div className="space-y-4">
						{Object.entries(
							modules.reduce<Record<string, CatalogItem[]>>((acc, m) => {
								const cat = m.categorie || "Général";
								acc[cat] = acc[cat] ?? [];
								acc[cat].push(m);
								return acc;
							}, {})
						).map(([cat, list]) => (
							<div key={cat} className="space-y-2">
								<p className="text-xs font-bold uppercase tracking-wider text-primary">
									{cat}
								</p>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{list.map((m) => (
										<ModuleCard
											key={m.id}
											item={m}
											variant="module"
											onLaunch={onLaunchModule}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				)}
				{tools.length > 0 && (
					<>
						<p className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-4 border-t border-border/20">
							Outils réutilisables
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{tools.map((t) => (
								<ModuleCard
									key={t.id}
									item={t}
									variant="tool"
									onLaunch={onLaunchModule}
								/>
							))}
						</div>
					</>
				)}
			</>
		);
	};

	return (
		<div className="space-y-6">
			{/* Actions pour votre métier */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-bold text-foreground">
						Actions pour votre métier
					</h2>
					<span className="text-xs text-muted-foreground">
						{metier?.nom_metier ?? "Profil générique"}
					</span>
				</div>
				{renderMetierActions()}
			</div>

			{/* Recommandations IA (existant) */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-bold text-foreground">
						Recommandations IA
					</h2>
				</div>

				{isLoading && <LoadingSpinner />}
				{!isLoading && filtered.length === 0 && (
					<EmptyTab icon={Lightbulb} title="Aucune recommandation" />
				)}
				{!isLoading && filtered.length > 0 && (
					<div className="space-y-2">
						{filtered.map((r) => (
							<div
								key={r.id}
								className="p-4 bg-card border border-border/50 rounded-xl"
							>
								<div className="flex items-start gap-3">
									<div
										className={cn(
											"flex-shrink-0 mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold",
											recommandationPriorityClass(r.priority),
										)}
									>
										P{r.priority}
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold text-foreground">
											{r.title ?? r.action}
										</p>
										{r.rationale && (
											<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
												{r.rationale}
											</p>
										)}
									</div>
									{r.score != null && (
										<span className="text-xs font-bold text-foreground flex-shrink-0">
											{Math.round(r.score * 100)}%
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Rendu unifié au niveau parent */}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Documents
// ---------------------------------------------------------------------------


