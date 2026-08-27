import { AlertTriangle, ArrowLeft, Building2, Calendar, Loader2, MapPin, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useUploadDocumentDirect } from "@/api/documents";
import { useEntreprise, useRefreshEntreprise } from "@/api/entreprises";
import { type Proposal, useExportDocument } from "@/api/export";
import {
	type ExecuteModuleResponse,
	useDetectMetier,
	useExecuteModule,
} from "@/api/modules";
import { RELATION_TYPES, usePortefeuilleEntreprise } from "@/api/portefeuille";
import { cn } from "@/lib/utils";
import {
	bandeauSeverityClass,
	buildContexteEntreprise,
	scoreBadgeSeverityClass,
} from "./entreprise-detail/helpers";
import { ErrorView } from "./entreprise-detail/etats";
import { StatusBadge } from "./entreprise-detail/identite";
import { ModuleLivrableDrawer } from "./entreprise-detail/ModuleCard";
import { TabAnalyses } from "./entreprise-detail/TabAnalyses";
import { TabCopilote } from "./entreprise-detail/TabCopilote";
import { TabDocuments } from "./entreprise-detail/TabDocuments";
import { TabFinances } from "./entreprise-detail/TabFinances";
import { TabIdentite } from "./entreprise-detail/TabIdentite";
import { TabJournal } from "./entreprise-detail/TabJournal";
import { TabModules } from "./entreprise-detail/TabModules";
import { TabPlaybooks } from "./entreprise-detail/TabPlaybooks";
import { TabRecommandations } from "./entreprise-detail/TabRecommandations";
import { type CatalogItem, TABS, type TabId } from "./entreprise-detail/types";

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EntrepriseDetailPage() {
	const { siren } = useParams<{ siren: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const activeTab = (searchParams.get("tab") ?? "identite") as TabId;
	const activeModule = searchParams.get("module");

	const execute = useExecuteModule();
	const upload = useUploadDocumentDirect();
	const exportMut = useExportDocument();

	const [running, setRunning] = useState<CatalogItem | null>(null);
	const [livrable, setLivrable] = useState<ExecuteModuleResponse | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [archived, setArchived] = useState(false);

	const { data: enriched, isLoading, isError } = useEntreprise(siren);
	const { data: portefeuille } = usePortefeuilleEntreprise(siren);
	const refresh = useRefreshEntreprise();

	const { data: metier } = useDetectMetier(enriched?.identite?.code_naf);
	const metierId = metier?.id ?? "generique";

	const handleLaunchModule = (item: any) => {
		if (!item.prompt_id || !enriched?.identite) return;
		setRunning(item);
		setLivrable(null);
		setArchived(false);
		setDrawerOpen(true);
		execute.mutate(
			{
				metier_id: metierId,
				prompt_id: item.prompt_id,
				contexte_entreprise: buildContexteEntreprise(
					enriched.identite,
					enriched.identite.raison_sociale ?? siren,
					siren,
					metier,
				),
				preferences: { style: "consultant", duree: item.duree },
			},
			{ onSuccess: (res) => setLivrable(res) },
		);
	};

	const handleArchive = (markdown: string, item: CatalogItem) => {
		if (!enriched?.identite) return;
		const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
		const file = new File([blob], `${item.id}.md`, {
			type: "text/markdown;charset=utf-8",
		});
		upload.mutate(
			{
				file,
				title: `${item.titre} — ${enriched.identite.raison_sociale ?? siren}`,
				sourceKind: "module",
				siren,
			},
			{ onSuccess: () => setArchived(true) },
		);
	};

	const handleExport = (format: "pdf" | "docx", markdown: string) => {
		if (!enriched?.identite) return;
		const proposal: Proposal = {
			executiveSummary: markdown,
			contextAnalysis: "",
			recommendations: [],
			actionPlan: [],
			expectedBenefits: "",
			nextSteps: "",
		};
		exportMut.mutate({
			format,
			request: {
				proposition: proposal,
				meta: {
					company_name: enriched.identite.raison_sociale ?? siren,
					metier_label: metier?.nom_metier,
				},
			},
		});
	};

	// Change d'onglet tout en préservant le param `module` (ouvert par le copilote
	// lorsqu'il cite un module du métier). `goTo` est l'entrée utilisée par les
	// sources cliquables du copilote : `goTo("modules", moduleId)` ouvre la fiche
	// du module pertinent ; `goTo("analyses")` scroll l'onglet Analyses.
	function setTab(id: TabId, module?: string) {
		const next = new URLSearchParams(searchParams);
		next.set("tab", id);
		if (module) next.set("module", module);
		else next.delete("module");
		setSearchParams(next, { replace: true });
	}

	function goTo(id: TabId, module?: string) {
		setTab(id, module);
	}

	if (!siren || !/^\d{9}$/.test(siren)) {
		return <ErrorView message={`SIREN invalide : ${siren}`} />;
	}

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-64 gap-3 text-muted-foreground">
				<Loader2 className="w-7 h-7 animate-spin text-primary" />
				<p className="text-sm">Enrichissement en cours pour {siren}…</p>
			</div>
		);
	}

	if (isError || !enriched) {
		return (
			<ErrorView
				message="Impossible de charger cette entreprise"
				onBack={() => navigate(-1)}
			/>
		);
	}

	const { identite, scoring } = enriched;

	if (!identite) {
		return (
			<ErrorView
				message="Données d'identité indisponibles pour ce SIREN"
				onBack={() => navigate(-1)}
			/>
		);
	}
	const kindLabel = portefeuille
		? RELATION_TYPES.find((r) => r.value === portefeuille.kind)?.label
		: null;

	return (
		<div className="space-y-0">
			{/* ------------------------------------------------------------------ */}
			{/* En-tête entreprise                                                  */}
			{/* ------------------------------------------------------------------ */}
			<div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
				{/* Bandeau couleur selon severity */}
				<div
					className={cn("h-1.5", bandeauSeverityClass(scoring))}
				/>

				<div className="px-6 pt-5 pb-4">
					{/* Breadcrumb */}
					<button
						type="button"
						onClick={() => navigate("/entreprises")}
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
						Portefeuille
					</button>

					<div className="flex flex-col sm:flex-row sm:items-start gap-4">
						<div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
							<Building2 className="w-6 h-6" />
						</div>

						<div className="flex-1 min-w-0">
							<div className="flex flex-wrap items-center gap-2 mb-1">
								<h1 className="text-xl font-extrabold text-foreground">
									{identite.raison_sociale ?? siren}
								</h1>
								<StatusBadge statut={identite.statut} />
								{kindLabel && (
									<span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
										{kindLabel}
									</span>
								)}
								{enriched.finances?.procedure_collective && (
									<button
										type="button"
										onClick={() => setTab("finances")}
										className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-colors"
										title={enriched.finances.procedure_collective.libelle}
									>
										<AlertTriangle className="w-3 h-3" />
										{enriched.finances.procedure_collective.libelle}
									</button>
								)}
							</div>

							<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
								<span className="font-mono font-semibold text-foreground">
									{siren}
								</span>
								{identite.code_naf && (
									<span>
										{identite.code_naf} · {identite.libelle_naf}
									</span>
								)}
								{identite.ville && (
									<span className="flex items-center gap-1">
										<MapPin className="w-3.5 h-3.5" />
										{identite.ville}
									</span>
								)}
								{/* `synthese` est optionnel côté API : sans elle, on masque
								    l'ancienneté plutôt que de faire tomber la page. */}
								{identite.date_creation &&
									enriched.synthese?.points_cles?.anciennete_ans != null && (
										<span className="flex items-center gap-1">
											<Calendar className="w-3.5 h-3.5" />
											{enriched.synthese.points_cles.anciennete_ans} ans
										</span>
									)}
							</div>
						</div>

						{/* Score + refresh */}
						<div className="flex flex-col items-end gap-2 flex-shrink-0">
							{scoring && (
								<div
									className={cn(
										"w-16 h-16 rounded-2xl flex flex-col items-center justify-center",
										scoreBadgeSeverityClass(scoring.severity),
									)}
								>
									<span className="text-2xl font-extrabold leading-none">
										{scoring.score_global}
									</span>
									<span className="text-[9px] font-bold text-muted-foreground mt-0.5">
										/100
									</span>
								</div>
							)}
							<button
								type="button"
								onClick={() => refresh.mutate(siren)}
								disabled={refresh.isPending}
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
							>
								<RefreshCw
									className={cn("w-3 h-3", refresh.isPending && "animate-spin")}
								/>
								Actualiser
							</button>
						</div>
					</div>
				</div>

				{/* Barre d'onglets */}
				<div className="flex overflow-x-auto border-t border-border scrollbar-none">
					{TABS.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;
						return (
							<button
								type="button"
								key={tab.id}
								onClick={() => setTab(tab.id)}
								className={cn(
									"flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0",
									isActive
										? "border-primary text-primary"
										: "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
								)}
							>
								<Icon className="w-4 h-4" />
								{tab.label}
							</button>
						);
					})}
				</div>
			</div>

			{/* ------------------------------------------------------------------ */}
			{/* Contenu de l'onglet actif                                           */}
			{/* ------------------------------------------------------------------ */}
			<div>
				{activeTab === "identite" && <TabIdentite enriched={enriched} />}
				{activeTab === "finances" && (
					<TabFinances finances={enriched.finances ?? null} />
				)}
				{activeTab === "analyses" && (
					<TabAnalyses
						siren={siren}
						onLaunchModule={handleLaunchModule}
					/>
				)}
				{activeTab === "recommandations" && (
					<TabRecommandations
						siren={siren}
						identite={identite}
						onLaunchModule={handleLaunchModule}
					/>
				)}
				{activeTab === "modules" && (
					<TabModules siren={siren} activeModule={activeModule} goTo={goTo} />
				)}
				{activeTab === "documents" && <TabDocuments siren={siren} />}
				{activeTab === "journal" && <TabJournal siren={siren} />}
				{activeTab === "copilote" && (
					<TabCopilote
						siren={siren}
						raisonSociale={identite.raison_sociale ?? siren}
						goTo={goTo}
					/>
				)}
				{activeTab === "playbooks" && <TabPlaybooks />}
			</div>

			{identite && (
				<ModuleLivrableDrawer
					open={drawerOpen}
					item={running}
					raisonSociale={identite.raison_sociale ?? siren}
					isPending={execute.isPending}
					livrable={livrable}
					error={execute.error}
					archived={archived}
					onClose={() => setDrawerOpen(false)}
					onArchive={handleArchive}
					onExport={handleExport}
				/>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Identité
// ---------------------------------------------------------------------------




// ---------------------------------------------------------------------------
// Onglet Playbooks
// ---------------------------------------------------------------------------

