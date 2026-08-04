import {
	AlertTriangle,
	ArrowLeft,
	ArrowUpRight,
	ArrowDownRight,
	BarChart3,
	Blocks,
	BookOpen,
	Bot,
	Building2,
	Calendar,
	CheckCircle2,
	ChevronRight,
	Circle,
	CircleDot,
	Clock,
	Copy,
	Download,
	Eye,
	FileText,
	LayoutGrid,
	Lightbulb,
	Loader2,
	MapPin,
	Minus,
	PiggyBank,
	Play,
	Plus,
	RefreshCw,
	Rocket,
	Send,
	Sparkles,
	Target,
	TrendingUp,
	Users,
	Workflow,
	X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAnalyses, useLaunchAnalysis } from "@/api/analyses";
import {
	type ConverseMessage,
	useCopilotConverse,
	useCopilotHealth,
} from "@/api/copilot";
import { useDocuments, useUploadDocumentDirect } from "@/api/documents";
import {
	type ExerciceFinancier,
	type FinancesData,
	type Identite,
	type ScoreAxe,
	useEntreprise,
	useRefreshEntreprise,
} from "@/api/entreprises";
import { type Proposal, useExportDocument } from "@/api/export";
import { useJournalEvents } from "@/api/journal";
import {
	type PmeModuleDTO,
	type PmeToolDTO,
	useMetierModules,
} from "@/api/metiers";
import {
	type ExecuteModuleResponse,
	useDetectMetier,
	useExecuteModule,
} from "@/api/modules";
import { RELATION_TYPES, usePortefeuilleEntreprise } from "@/api/portefeuille";
import {
	type ContextualDiagnosticResponse,
	useContextualDiagnostic,
	useRecommandationsForJobs,
	type ConsultantPlanEtape,
	type ConsultantKpi,
	type ConsultantScenario,
} from "@/api/recommandations";
import { cn } from "@/lib/utils";
import { libelleTrancheEffectif } from "@/lib/trancheEffectif";

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

const TABS = [
	{ id: "identite", label: "Identité", icon: Building2 },
	{ id: "finances", label: "Finances", icon: PiggyBank },
	{ id: "analyses", label: "Analyses", icon: BarChart3 },
	{ id: "recommandations", label: "Recommandations", icon: Lightbulb },
	{ id: "modules", label: "Modules", icon: LayoutGrid },
	{ id: "documents", label: "Documents", icon: FileText },
	{ id: "journal", label: "Journal", icon: BookOpen },
	{ id: "copilote", label: "Copilote IA", icon: Sparkles },
	{ id: "playbooks", label: "Playbooks", icon: Workflow },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Couleur du bandeau d'en-tête selon la sévérité du scoring — table de
// correspondance plutôt que ternaires imbriquées.
function bandeauSeverityClass(scoring: { severity?: string } | null | undefined): string {
	if (scoring?.severity === "faible") return "bg-emerald-500";
	if (scoring?.severity === "modéré") return "bg-amber-400";
	if (scoring) return "bg-red-500";
	return "bg-muted";
}

// Couleurs du badge de score selon la sévérité — table de correspondance
// plutôt que ternaires imbriquées.
function scoreBadgeSeverityClass(severity: string | undefined): string {
	if (severity === "faible") return "bg-emerald-500/10 text-emerald-600";
	if (severity === "modéré") return "bg-amber-500/10 text-amber-500";
	return "bg-red-500/10 text-red-500";
}

// Couleurs du badge de priorité d'une recommandation — table de
// correspondance plutôt que ternaires imbriquées.
function recommandationPriorityClass(priority: number): string {
	if (priority <= 2) return "bg-red-500/10 text-red-600";
	if (priority <= 4) return "bg-amber-500/10 text-amber-600";
	return "bg-muted text-muted-foreground";
}

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
					<TabFinances
						finances={enriched.finances ?? null}
						raisonSociale={identite.raison_sociale ?? siren}
					/>
				)}
				{activeTab === "analyses" && (
					<TabAnalyses
						siren={siren}
						goTo={goTo}
						onLaunchModule={handleLaunchModule}
					/>
				)}
				{activeTab === "recommandations" && (
					<TabRecommandations
						siren={siren}
						identite={identite}
						raisonSociale={identite.raison_sociale ?? siren}
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

function TabIdentite({
	enriched,
}: {
	readonly enriched: import("@/api/entreprises").EntrepriseEnrichie;
}) {
	const { identite, scoring, bodacc, geolocalisation, synthese } = enriched;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
			{/* Score */}
			<div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
				<div className="flex items-center gap-2 mb-4">
					<TrendingUp className="w-4 h-4 text-primary" />
					<h2 className="text-sm font-bold">Score PME Platform</h2>
					{scoring && (
						<span className="ml-auto text-2xl font-extrabold">
							{scoring.score_global}
							<span className="text-base font-normal text-muted-foreground">
								/100
							</span>
						</span>
					)}
				</div>
				<div className="space-y-3">
					{scoring &&
						Object.entries(scoring.axes).map(([key, axe]) => (
							<AxeRow key={key} axeKey={key} axe={axe} />
						))}
				</div>
			</div>

			{/* Identité + Géo */}
			<div className="space-y-4">
				<IdentiteCard identite={identite} />
				{geolocalisation && (
					<div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
						<div className="flex items-center gap-2 mb-3">
							<MapPin className="w-4 h-4 text-primary" />
							<h2 className="text-sm font-bold">Localisation</h2>
						</div>
						<p className="text-xs text-muted-foreground">
							{geolocalisation.label}
						</p>
						<a
							href={`https://www.openstreetmap.org/?mlat=${geolocalisation.latitude}&mlon=${geolocalisation.longitude}&zoom=15`}
							target="_blank"
							rel="noreferrer"
							className="block mt-2 text-xs text-primary hover:underline"
						>
							Voir sur OpenStreetMap →
						</a>
					</div>
				)}
			</div>

			{/* Dirigeants */}
			{identite.dirigeants.length > 0 && (
				<div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
					<div className="flex items-center gap-2 mb-4">
						<Users className="w-4 h-4 text-primary" />
						<h2 className="text-sm font-bold">Dirigeants</h2>
					</div>
					<div className="divide-y divide-border/50">
						{identite.dirigeants.map((d) => (
							<div
								key={`${d.prenoms ?? ""}-${d.nom ?? ""}-${d.qualite ?? ""}`}
								className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
							>
								<div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
									{(d.prenoms?.[0] ?? d.nom?.[0] ?? "?").toUpperCase()}
								</div>
								<div>
									<p className="text-sm font-semibold">
										{[d.prenoms, d.nom].filter(Boolean).join(" ") || "—"}
									</p>
									<p className="text-xs text-muted-foreground">{d.qualite}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* BODACC */}
			<div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
				<div className="flex items-center gap-2 mb-4">
					<FileText className="w-4 h-4 text-primary" />
					<h2 className="text-sm font-bold">BODACC</h2>
					<span className="text-xs text-muted-foreground ml-1">
						{bodacc.signaux.total} événements
					</span>
					{bodacc.signaux.risque > 0 && (
						<span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-xs font-bold">
							⚠ {bodacc.signaux.risque} risque
							{bodacc.signaux.risque > 1 ? "s" : ""}
						</span>
					)}
				</div>
				<div className="space-y-1">
					{bodacc.evenements.slice(0, 5).map((ev) => (
						<div
							key={`${ev.date}-${ev.type}`}
							className="flex items-start gap-3 px-3 py-2 rounded-lg bg-muted/30 text-xs"
						>
							<span className="text-muted-foreground w-20 flex-shrink-0">
								{new Date(ev.date).toLocaleDateString("fr-FR", {
									day: "2-digit",
									month: "short",
									year: "2-digit",
								})}
							</span>
							<span className="font-medium text-foreground">{ev.type}</span>
						</div>
					))}
				</div>
			</div>

			{/* Synthèse */}
			<div className="lg:col-span-3 bg-muted/30 border border-border/40 rounded-xl px-5 py-4">
				<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
					Synthèse
				</p>
				<p className="text-sm text-muted-foreground leading-relaxed">
					{synthese.texte}
				</p>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Section diagnostic consultant (Lot C) — intégrée à l'onglet Analyses
// ---------------------------------------------------------------------------

function extractDiagnosticError(err: unknown): string {
	const axiosErr = err as {
		response?: { data?: { error?: { message?: string } }; statusText?: string };
	};
	return (
		axiosErr?.response?.data?.error?.message ??
		axiosErr?.response?.statusText ??
		"Le diagnostic consultant n'est pas disponible pour le moment."
	);
}

const TREND_TONE: Record<string, string> = {
	hausse: "text-emerald-600",
	baisse: "text-red-600",
	stable: "text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Sous-composants pour le Diagnostic Consultant (Lot C)
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { readonly score: number }) {
	const r = 52;
	const c = 2 * Math.PI * r;
	const offset = c - (score / 100) * c;
	return (
		<div className="relative h-28 w-28 shrink-0 flex-shrink-0">
			<svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full">
				<circle
					cx="60"
					cy="60"
					r={r}
					stroke="currentColor"
					strokeWidth="10"
					className="text-muted/30"
					fill="none"
				/>
				<circle
					cx="60"
					cy="60"
					r={r}
					stroke="currentColor"
					strokeWidth="10"
					strokeLinecap="round"
					className="text-primary"
					fill="none"
					strokeDasharray={c}
					strokeDashoffset={offset}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-2xl font-extrabold text-foreground">{score}</span>
				<span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
					Score global
				</span>
			</div>
		</div>
	);
}

const IMPACT_STYLE: Record<string, { label: string; cls: string }> = {
	faible: { label: "Impact faible", cls: "bg-muted text-muted-foreground border border-border" },
	moyen:  { label: "Impact moyen",  cls: "bg-primary/5 text-primary border border-primary/10" },
	fort:   { label: "Impact fort",   cls: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" },
};

function ImpactBadge({ impact, compact = false }: { readonly impact: string; readonly compact?: boolean }) {
	const imp = impact.toLowerCase();
	const s = IMPACT_STYLE[imp] ?? IMPACT_STYLE.faible;
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full font-bold whitespace-nowrap",
				compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
				s.cls
			)}
		>
			{compact ? impact.charAt(0).toUpperCase() + impact.slice(1) : s.label}
		</span>
	);
}

const STATUS_MAP = {
	termine:  { label: "Terminé",   icon: <CheckCircle2 className="h-4 w-4" />,         colorCls: "text-emerald-500 bg-emerald-500/10" },
	en_cours: { label: "En cours",  icon: <Loader2 className="h-4 w-4 animate-spin" />, colorCls: "text-primary bg-primary/10" },
	a_faire:  { label: "À faire",   icon: <Circle className="h-4 w-4 text-muted-foreground" />, colorCls: "text-muted-foreground/30 bg-muted/40" },
} as const;

const CTA_ICON: Record<string, React.ReactNode> = {
	Voir:   <Eye className="h-3.5 w-3.5" />,
	Créer:  <Plus className="h-3.5 w-3.5" />,
	Lancer: <Play className="h-3.5 w-3.5" />,
	Suivre: <TrendingUp className="h-3.5 w-3.5" />,
};

function PlanRow({
	etape,
	index,
	onCta,
}: {
	readonly etape: ConsultantPlanEtape;
	readonly index: number;
	readonly onCta: () => void;
}) {
	const statut = (etape.statut ?? "a_faire").toLowerCase() as keyof typeof STATUS_MAP;
	const status = STATUS_MAP[statut] ?? STATUS_MAP.a_faire;
	const isCurrent = statut === "en_cours";
	return (
		<li
			className={cn(
				"rounded-xl border bg-card transition-all duration-200",
				isCurrent
					? "border-primary/40 bg-primary/5"
					: "border-border/60 hover:border-border"
			)}
		>
			<div className="flex items-center gap-3 px-4 py-3">
				<span className="text-xs font-semibold text-muted-foreground w-5 tabular-nums">
					{String(index).padStart(2, "0")}
				</span>
				<span className={cn("shrink-0 p-1 rounded-md", status.colorCls)}>{status.icon}</span>
				<p
					className={cn(
						"flex-1 text-sm text-foreground",
						isCurrent ? "font-semibold" : ""
					)}
				>
					{etape.titre}
					{isCurrent && (
						<span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20">
							En cours
						</span>
					)}
				</p>
				{etape.echeance && (
					<span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground">
						<Clock className="h-3.5 w-3.5" />
						{etape.echeance}
					</span>
				)}
				<ImpactBadge impact={etape.impact} compact />
				<button
					type="button"
					onClick={onCta}
					className={cn(
						"inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all",
						isCurrent
							? "bg-primary text-primary-foreground hover:bg-primary/95"
							: "bg-card border border-border text-foreground hover:bg-accent hover:border-border"
					)}
				>
					{CTA_ICON[etape.cta] ?? <Play className="h-3.5 w-3.5" />}
					{etape.cta}
				</button>
			</div>

			{isCurrent && etape.messageIA && (
				<div className="mx-4 mb-3 -mt-1 flex gap-2 px-3 py-2 rounded-lg bg-muted/50 animate-in fade-in duration-300">
					<Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
					<p className="text-xs text-muted-foreground leading-relaxed">
						{etape.messageIA}
					</p>
				</div>
			)}
		</li>
	);
}

function ProgressBar({ plan, className = "" }: { readonly plan: ConsultantPlanEtape[]; readonly className?: string }) {
	const total = plan.length;
	const done = plan.filter((e) => e.statut?.toLowerCase() === "termine").length;
	const inProgress = plan.filter((e) => e.statut?.toLowerCase() === "en_cours").length;
	const pct = total === 0 ? 0 : Math.round(((done + inProgress * 0.5) / total) * 100);
	return (
		<div className={className}>
			<div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
				<span>Progression globale</span>
				<span className="font-semibold text-foreground">{pct}%</span>
			</div>
			<div className="h-2 w-full overflow-hidden rounded-full bg-muted/40 border border-border/40">
				<div
					className="h-full rounded-full bg-primary transition-all duration-700"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

const TREND_STYLE: Record<string, { icon: React.ReactNode; cls: string }> = {
	up:   { icon: <ArrowUpRight className="h-4 w-4" />,   cls: "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" },
	down: { icon: <ArrowDownRight className="h-4 w-4" />, cls: "text-red-600 bg-red-500/10 border border-red-500/20" },
	flat: { icon: <Minus className="h-4 w-4" />,          cls: "text-muted-foreground bg-muted border border-border" },
};

function KpiCard({ kpi }: { readonly kpi: ConsultantKpi }) {
	const trendKey = (kpi.tendance ?? "flat").toLowerCase();
	const trend = TREND_STYLE[trendKey] ?? TREND_STYLE.flat;
	return (
		<div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
				<span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", trend.cls)}>
					{trend.icon}
				</span>
			</div>
			<div>
				<p className="text-3xl font-extrabold text-foreground leading-none">
					{kpi.valeur}
					<span className="text-sm text-muted-foreground font-normal ml-0.5">/100</span>
				</p>
				<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/40 border border-border/40">
					<div
						className="h-full rounded-full bg-primary transition-all duration-700"
						style={{ width: `${kpi.valeur}%` }}
					/>
				</div>
			</div>
			<div className="space-y-2 pt-2 border-t border-border/40">
				<div className="flex gap-2">
					<Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
					<p className="text-xs text-muted-foreground leading-relaxed">
						{kpi.interpretation}
					</p>
				</div>
				<div className="flex gap-2">
					<Lightbulb className="h-3.5 w-3.5 text-primary/80 shrink-0 mt-0.5" />
					<p className="text-xs text-foreground font-medium leading-relaxed">
						{kpi.recommandation}
					</p>
				</div>
			</div>
		</div>
	);
}

function ScenarioRow({
	icon,
	label,
	value,
	help,
	accent = false,
}: {
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly value: string;
	readonly help: string;
	readonly accent?: boolean;
}) {
	return (
		<div className="flex items-start gap-3 py-2.5 border-b last:border-0 border-border/30">
			<span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
			<div className="flex-1 min-w-0">
				<div className="flex items-baseline justify-between gap-2">
					<span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
						{label}
					</span>
					<span
						className={cn(
							"text-sm font-extrabold",
							accent ? "text-foreground" : "text-muted-foreground"
						)}
					>
						{value}
					</span>
				</div>
				<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{help}</p>
			</div>
		</div>
	);
}

function ProjectionBlock({
	visAvant,
	avec,
	sans,
}: {
	readonly visAvant: number;
	readonly avec: ConsultantScenario;
	readonly sans: ConsultantScenario;
}) {
	const deltaAvec = avec.visibilite - visAvant;
	const deltaSans = sans.visibilite - visAvant;
	return (
		<div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-4">
			<div className="flex items-start gap-3">
				<span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
					<Target className="h-4 w-4" />
				</span>
				<div>
					<h3 className="text-sm font-bold text-foreground">Projection à 30 jours</h3>
					<p className="text-xs text-muted-foreground">
						Comparaison entre lancer l'action prioritaire et ne rien faire.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
				{/* Plan appliqué */}
				<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
					<div className="flex items-center gap-2 mb-2">
						<span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
							<Rocket className="h-3.5 w-3.5" />
						</span>
						<h4 className="text-xs font-bold text-foreground">
							Plan appliqué
						</h4>
						<span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold px-2 py-0.5 border border-primary/20">
							Recommandé
						</span>
					</div>
					<ScenarioRow
						icon={<Rocket className="h-4 w-4" />}
						label="Opportunités"
						value={`+${avec.opportunites}`}
						help={`${avec.opportunites} RDV qualifiés probables`}
						accent
					/>
					<ScenarioRow
						icon={<TrendingUp className="h-4 w-4" />}
						label="Visibilité"
						value={`${visAvant} → ${avec.visibilite}`}
						help={`${deltaAvec >= 0 ? "+" : ""}${deltaAvec} pts attendus`}
						accent
					/>
					<ScenarioRow
						icon={<ArrowUpRight className="h-4 w-4" />}
						label="Pipeline"
						value="Renforcé"
						help={avec.pipelineEtat}
						accent
					/>
				</div>

				{/* Sans action immédiate */}
				<div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2">
					<div className="flex items-center gap-2 mb-2">
						<span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-muted-foreground">
							<Minus className="h-3.5 w-3.5" />
						</span>
						<h4 className="text-xs font-bold text-muted-foreground">
							Sans action immédiate
						</h4>
						<span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5">
							Trajectoire actuelle
						</span>
					</div>
					<ScenarioRow
						icon={<Rocket className="h-4 w-4" />}
						label="Opportunités"
						value={`+${sans.opportunites}`}
						help={
							sans.opportunites === 0
								? "Aucune opportunité supplémentaire projetée."
								: `${sans.opportunites} RDV qualifiés projetés`
						}
					/>
					<ScenarioRow
						icon={<Minus className="h-4 w-4" />}
						label="Visibilité"
						value={`${visAvant} → ${sans.visibilite}`}
						help={`${deltaSans >= 0 ? "+" : ""}${deltaSans} pts projetés`}
					/>
					<ScenarioRow
						icon={<Minus className="h-4 w-4" />}
						label="Pipeline"
						value="Stable"
						help={sans.pipelineEtat}
					/>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Section Principale du Diagnostic Consultant
// ---------------------------------------------------------------------------

function ConsultantDiagnosticSection({
	siren,
	isPending,
	isError,
	error,
	data,
	onGenerate,
	onLaunchModule,
	onRefresh,
	isRefreshing,
}: {
	readonly siren: string;
	readonly isPending: boolean;
	readonly isError: boolean;
	readonly error: unknown;
	readonly data: ContextualDiagnosticResponse | undefined;
	readonly onGenerate: () => void;
	readonly onLaunchModule: (item: any) => void;
	readonly onRefresh?: () => void;
	readonly isRefreshing?: boolean;
}) {
	const diag = data?.diagnostic;
	const delta = diag ? diag.scoreGlobal - diag.scorePrecedent : 0;
	const actionsSecondaires = diag ? diag.plan.filter(e => e.statut?.toLowerCase() === "a_faire") : [];

	return (
		<div className="space-y-6">
			{/* En-tête + bouton Générer */}
			<div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<p className="text-xs font-bold uppercase tracking-widest text-primary">Analyses</p>
					<h1 className="text-2xl font-extrabold text-foreground mt-0.5">
						Votre situation, expliquée
					</h1>
					<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
						Une vue claire et orientée action : ce qu'il faut faire <em>maintenant</em>, ce qui peut suivre, et ce que ça va changer dans 30 jours.
					</p>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0 self-start md:self-center">
					{onRefresh && diag && (
						<button
							type="button"
							onClick={onRefresh}
							disabled={isRefreshing || isPending}
							className="inline-flex items-center justify-center p-2 h-9 w-9 rounded-xl border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60"
							title="Rafraîchir le diagnostic depuis la base"
						>
							<RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
						</button>
					)}
					<button
						type="button"
						onClick={onGenerate}
						disabled={isPending}
						className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 disabled:opacity-60 flex-shrink-0"
					>
						{isPending ? (
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
						) : (
							<Sparkles className="w-3.5 h-3.5" />
						)}
						{diag ? "Relancer l'analyse" : "Générer le diagnostic"}
					</button>
				</div>
			</div>

			{isError && (
				<p className="text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
					{extractDiagnosticError(error)}
				</p>
			)}

			{isPending && (
				<div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground bg-card border border-border/50 rounded-2xl">
					<Loader2 className="w-7 h-7 animate-spin text-primary" />
					<p className="text-sm font-semibold text-foreground">L'IA analyse votre situation…</p>
					<p className="text-xs">Cette étape prend environ 10 à 30 secondes.</p>
				</div>
			)}

			{diag && !isPending && (
				<>
					{/* 1. HERO — Score + Synthèse IA + Action Prioritaire */}
					<div className="bg-card border border-border/50 rounded-2xl p-5 md:p-6 shadow-sm space-y-6">
						<div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
							{/* Score global */}
							<div className="flex flex-col items-center gap-2 self-center md:self-start">
								<ScoreRing score={diag.scoreGlobal} />
								{delta !== 0 && (
									<span
										className={cn(
											"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold",
											delta > 0
												? "bg-emerald-500/10 text-emerald-600"
												: "bg-red-500/10 text-red-600"
										)}
									>
										<TrendingUp
											className={cn("w-3 h-3", delta < 0 && "rotate-180")}
										/>
										{delta > 0 ? "+" : ""}
										{delta} pts depuis dernière analyse
									</span>
								)}
							</div>

							{/* Synthèse IA & Action Prioritaire */}
							<div className="flex-1 space-y-5 w-full">
								<div className="space-y-1.5">
									<div className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider">
										<Sparkles className="w-3.5 h-3.5" />
										Synthèse IA
									</div>
									<p className="text-base font-bold text-foreground leading-snug">
										{diag.diagnostic}
									</p>
								</div>

								{/* Carte Action Prioritaire */}
								{diag.actionPrioritaireDefault && (
									<div className="bg-primary/5 border border-primary/25 rounded-2xl p-4 md:p-5 space-y-4">
										<div className="flex flex-wrap items-center gap-2">
											<span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
												Action prioritaire
											</span>
											<span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold border border-amber-500/20">
												Priorité cette semaine
											</span>
											<span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20">
												Impact fort
											</span>
										</div>
										<div className="space-y-1">
											<h3 className="text-base font-extrabold text-foreground">
												{diag.actionPrioritaireDefault.titre}
											</h3>
											<p className="text-xs text-muted-foreground leading-relaxed">
												{diag.actionPrioritaireDefault.description}
											</p>
										</div>
										<div className="flex items-center gap-4">
											<button
												type="button"
												onClick={() =>
													onLaunchModule({
														id: diag.actionPrioritaireDefault.promptIA,
														titre: diag.actionPrioritaireDefault.titre,
														description: diag.actionPrioritaireDefault.description,
														prompt_id: diag.actionPrioritaireDefault.promptIA,
														duree: diag.actionPrioritaireDefault.duree,
														prompt: "",
													})
												}
												className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 shadow-sm transition-colors"
											>
												<Rocket className="w-3.5 h-3.5" />
												Lancer maintenant
											</button>
											<span className="flex items-center gap-1 text-xs text-muted-foreground">
												<Clock className="w-3.5 h-3.5" />
												{diag.actionPrioritaireDefault.duree}
											</span>
										</div>
									</div>
								)}

								{/* Actions secondaires */}
								{actionsSecondaires.length > 0 && (
									<div className="space-y-2 pt-2">
										<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
											Actions secondaires
										</p>
										<div className="divide-y divide-border/40 border-t border-border/40">
											{actionsSecondaires.map((act) => (
												<div
													key={act.titre}
													className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
												>
													<div className="min-w-0">
														<p className="text-xs font-semibold text-foreground truncate">
															{act.titre}
														</p>
														{act.echeance && (
															<p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
																<Clock className="w-3 h-3" />
																{act.echeance} · Impact {act.impact}
															</p>
														)}
													</div>
													<button
														type="button"
														onClick={() =>
															onLaunchModule({
																id: act.titre,
																titre: act.titre,
																description: act.titre,
																prompt_id: act.messageIA ? "generique" : act.titre, // fallback prompt
																duree: "5 min",
																prompt: "",
															})
														}
														className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg border border-border text-xs font-bold hover:bg-accent text-foreground transition-all flex-shrink-0"
													>
														{act.cta} <ChevronRight className="w-3 h-3 ml-0.5" />
													</button>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* 2. AXES D'ANALYSE (KPIs) — 3 cartes en ligne */}
					{diag.kpis.length > 0 && (
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{diag.kpis.map((k) => (
								<KpiCard key={k.label} kpi={k} />
							))}
						</div>
					)}

					{/* 3. PLAN D'ACTION RECOMMANDÉ */}
					{diag.plan.length > 0 && (
						<div className="bg-card border border-border/50 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
							<div className="space-y-1">
								<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
									<Workflow className="w-4 h-4 text-primary" />
									Plan d'action
								</h3>
								<p className="text-xs text-muted-foreground">
									Étapes recommandées pour atteindre votre objectif
								</p>
							</div>
							<ul className="space-y-3.5 pt-2">
								{diag.plan.map((etape, i) => (
									<PlanRow
										key={etape.titre}
										etape={etape}
										index={i + 1}
										onCta={() =>
											onLaunchModule({
												id: etape.titre,
												titre: etape.titre,
												description: etape.titre,
												prompt_id: etape.messageIA ? "generique" : etape.titre,
												duree: "5 min",
												prompt: "",
											})
										}
									/>
								))}
							</ul>
							<ProgressBar plan={diag.plan} className="pt-3 border-t border-border/40" />
						</div>
					)}

					{/* 4. PROJECTION À 30 JOURS */}
					{diag.projection && (
						<ProjectionBlock
							visAvant={diag.projection.visibiliteAvant}
							avec={diag.projection.avecAction}
							sans={diag.projection.sansAction}
						/>
					)}
				</>
			)}

			{!diag && !isPending && !isError && (
				<div className="bg-card border border-border/50 rounded-2xl p-8 shadow-sm text-center space-y-3">
					<div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
						<Lightbulb className="w-6 h-6" />
					</div>
					<div>
						<p className="text-sm font-semibold text-foreground">Aucun diagnostic généré</p>
						<p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
							Générez le diagnostic consultant pour afficher l'action prioritaire, les indicateurs clés et le plan de progression à 30 jours de cette entreprise.
						</p>
					</div>
					<button
						type="button"
						onClick={onGenerate}
						className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95"
					>
						<Sparkles className="w-3.5 h-3.5" />
						Générez le diagnostic
					</button>
				</div>
			)}
		</div>
	);
}

function TabAnalyses({
	siren,
	goTo,
	onLaunchModule,
}: {
	readonly siren: string;
	readonly goTo: (id: TabId, module?: string) => void;
	readonly onLaunchModule: (item: any) => void;
}) {
	const navigate = useNavigate();
	const { data: analyses, refetch, isFetching } = useAnalyses(siren);
	const launch = useLaunchAnalysis();
	const diagnostic = useContextualDiagnostic();
	const lastAnalysis = (analyses ?? [])[0];

	// Chargeons les recommandations associées aux jobs de cette entreprise pour persistance
	const jobIds = useMemo(() => (analyses ?? []).map((a) => a.job_id).filter(Boolean), [analyses]);
	const { data: recos, refetch: refetchRecos, isFetching: isFetchingRecos } = useRecommandationsForJobs(jobIds);

	const savedDiagnosticData = useMemo(() => {
		const savedConsultantReco = recos?.find((r) => r.category === "consultant");
		if (savedConsultantReco?.payload) {
			try {
				const parsed = JSON.parse(savedConsultantReco.payload);
				return {
					siren,
					metierId: savedConsultantReco.metierId ?? lastAnalysis?.detected_business_id ?? "generique",
					diagnostic: parsed,
					actionPrioritaire: savedConsultantReco,
				};
			} catch (e) {
				console.warn("Failed to parse saved diagnostic payload", e);
			}
		}
		return undefined;
	}, [recos, siren, lastAnalysis]);

	const displayData = diagnostic.data || savedDiagnosticData;

	async function handleLaunch() {
		const ack = await launch.mutateAsync({ siren });
		navigate(`/analyse?jobId=${ack.job_id}`);
	}

	async function handleGenerateDiagnostic() {
		await diagnostic.mutateAsync({
			siren,
			jobId: lastAnalysis?.job_id,
			metierId: lastAnalysis?.detected_business_id ?? undefined,
		});
	}

	return (
		<div className="space-y-4">
			{/* Diagnostic consultant contextuel (Lot C) — orienté métier détecté. */}
			<ConsultantDiagnosticSection
				siren={siren}
				isPending={diagnostic.isPending}
				isError={diagnostic.isError}
				error={diagnostic.error}
				data={displayData}
				onGenerate={handleGenerateDiagnostic}
				onLaunchModule={onLaunchModule}
				onRefresh={() => {
					refetch();
					if (jobIds.length > 0) {
						refetchRecos();
					}
				}}
				isRefreshing={isFetching || isFetchingRecos}
			/>

			<div className="flex items-center justify-between pt-4 border-t border-border/40">
				<h2 className="text-sm font-bold text-foreground">Historique des analyses</h2>
				<div className="flex gap-2">
					<button
						onClick={() => refetch()}
						disabled={isFetching}
						className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					>
						<RefreshCw
							className={cn("w-4 h-4", isFetching && "animate-spin")}
						/>
					</button>
					<button
						onClick={handleLaunch}
						disabled={launch.isPending}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
					>
						<Plus className="w-4 h-4" />
						Nouvelle analyse
					</button>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Finances — inspiré de la structure Origami (bilans multi-exercices)
// ---------------------------------------------------------------------------

const FINANCE_ROWS: {
	key: keyof ExerciceFinancier;
	label: string;
	section: "cr" | "bilan";
}[] = [
	{ key: "chiffre_affaires",           label: "Chiffre d'affaires",          section: "cr"    },
	{ key: "excedent_brut_exploitation", label: "EBE",                          section: "cr"    },
	{ key: "resultat_exploitation",      label: "Résultat d'exploitation",      section: "cr"    },
	{ key: "resultat_net",               label: "Résultat net",                 section: "cr"    },
	{ key: "total_actif",                label: "Total actif",                  section: "bilan" },
	{ key: "capitaux_propres",           label: "Capitaux propres",             section: "bilan" },
	{ key: "tresorerie",                 label: "Trésorerie",                   section: "bilan" },
	{ key: "creances_clients",           label: "Créances clients",             section: "bilan" },
	{ key: "dettes_fiscales_sociales",   label: "Dettes fiscales & sociales",   section: "bilan" },
];

function fmtEuros(val: number | null | undefined): string {
	if (val == null) return "—";
	if (Math.abs(val) >= 1_000_000)
		return `${(val / 1_000_000).toFixed(2).replace(".", ",")}M €`;
	if (Math.abs(val) >= 1_000)
		return `${Math.round(val / 1_000)}K €`;
	return `${val.toLocaleString("fr-FR")} €`;
}

function TabFinances({
	finances,
	raisonSociale,
}: {
	readonly finances: FinancesData | null;
	readonly raisonSociale: string;
}) {
	const proc = finances?.procedure_collective;
	const exercices = (finances?.exercices ?? []).slice(0, 6); // max 6 colonnes

	return (
		<div className="space-y-4">
			{/* Procédure collective */}
			{proc && (
				<div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
					<AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
					<div>
						<p className="text-sm font-bold text-red-700">{proc.libelle}</p>
						<p className="text-xs text-red-600 mt-0.5">
							{proc.tribunal && <span>{proc.tribunal}</span>}
							{proc.tribunal && proc.date && " · "}
							{proc.date && (
								<span>
									{new Date(proc.date).toLocaleDateString("fr-FR", {
										day: "2-digit",
										month: "long",
										year: "numeric",
									})}
								</span>
							)}
						</p>
					</div>
				</div>
			)}

			{/* Tableau des exercices */}
			{exercices.length > 0 ? (
				<div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
					<div className="flex items-center gap-2 px-5 py-4 border-b border-border/50">
						<PiggyBank className="w-4 h-4 text-primary" />
						<h2 className="text-sm font-bold">Données financières</h2>
						{finances?.source && (
							<span className="ml-auto text-xs text-muted-foreground uppercase tracking-wider">
								Source : {finances.source}
							</span>
						)}
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b border-border/40 bg-muted/30">
									<th className="text-left px-5 py-2.5 font-semibold text-muted-foreground w-48">
										EN EUROS
									</th>
									{exercices.map((ex) => (
										<th
											key={ex.annee ?? ex.date_cloture}
											className="text-right px-4 py-2.5 font-bold text-foreground"
										>
											{ex.annee ?? "—"}
											{ex.confidentiel && (
												<span
													className="ml-1 text-muted-foreground font-normal"
													title="Comptes partiellement confidentiels"
												>
													*
												</span>
											)}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30">
								{(["cr", "bilan"] as const).map((section) => (
									<>
										<tr key={`header-${section}`} className="bg-muted/20">
											<td
												colSpan={exercices.length + 1}
												className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
											>
												{section === "cr"
													? "Compte de résultat"
													: "Bilan"}
											</td>
										</tr>
										{FINANCE_ROWS.filter((r) => r.section === section).map(
											(row) => (
												<tr
													key={row.key}
													className="hover:bg-muted/20 transition-colors"
												>
													<td className="px-5 py-2 text-muted-foreground">
														{row.label}
													</td>
													{exercices.map((ex) => {
														const val = ex[row.key] as
															| number
															| null
															| undefined;
														const isNeg =
															typeof val === "number" && val < 0;
														const isPos =
															typeof val === "number" && val > 0;
														const isKey =
															row.key === "resultat_net" ||
															row.key === "chiffre_affaires";
														let valueColorClass = "text-foreground";
														if (isKey && isNeg) valueColorClass = "text-red-600";
														else if (isKey && isPos) valueColorClass = "text-emerald-600";
														return (
															<td
																key={ex.annee}
																className={cn(
																	"px-4 py-2 text-right tabular-nums",
																	isKey && "font-semibold",
																	valueColorClass,
																)}
															>
																{val == null && ex.confidentiel
																	? "<conf.>"
																	: fmtEuros(val)}
															</td>
														);
													})}
												</tr>
											),
										)}
									</>
								))}
							</tbody>
						</table>
					</div>

					{exercices.some((e) => e.confidentiel) && (
						<p className="px-5 py-2.5 text-xs text-muted-foreground border-t border-border/30">
							* Comptes soumis à confidentialité partielle (art. L. 232-25 du
							Code de commerce).
						</p>
					)}
				</div>
			) : (
				<div className="bg-card border border-border/50 rounded-2xl p-8 shadow-sm text-center space-y-3">
					<PiggyBank className="w-8 h-8 text-muted-foreground/40 mx-auto" />
					<p className="text-sm font-semibold text-muted-foreground">
						Données financières non disponibles
					</p>
					<p className="text-xs text-muted-foreground max-w-xs mx-auto">
						Configurez la variable d'environnement{" "}
						<code className="font-mono bg-muted px-1 rounded">INPI_TOKEN</code>{" "}
						pour accéder aux bilans et comptes de résultat déposés au greffe
						(compte gratuit sur{" "}
						<a
							href="https://registre-national-entreprises.inpi.fr/"
							target="_blank"
							rel="noreferrer"
							className="text-primary hover:underline"
						>
							registre-national-entreprises.inpi.fr
						</a>
						{")."}
					</p>
				</div>
			)}
		</div>
	);
}

// Supprimé (doublon de TabAnalyses)

// ---------------------------------------------------------------------------
// Onglet Recommandations
// ---------------------------------------------------------------------------

// Extrait un message d'erreur lisible d'une réponse axios (le backend PME
// renvoie {error: {message}} ; on retombe sur le message générique).
function extractModuleError(err: unknown): string {
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
function buildContexteEntreprise(
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

function downloadModuleMarkdown(markdown: string, filename: string): void {
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

type CatalogItem = PmeModuleDTO | PmeToolDTO;

function ModuleCard({
	item,
	variant,
	onLaunch,
}: {
	readonly item: CatalogItem;
	readonly variant: "module" | "tool";
	readonly onLaunch: (item: CatalogItem) => void;
}) {
	const hasPromptId = !!item.prompt_id;
	const categorie = "categorie" in item ? item.categorie : null;
	return (
		<div className="flex flex-col p-4 bg-card border border-border/50 rounded-xl">
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm font-semibold text-foreground">{item.titre}</p>
				<span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
					{item.duree}
				</span>
			</div>
			<p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-1">
				{item.description}
			</p>
			<div className="flex items-center justify-between gap-2 mt-3">
				<div className="flex items-center gap-1.5">
					{variant === "tool" ? (
						<span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
							Outil
						</span>
					) : (
						categorie && (
							<span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
								{categorie}
							</span>
						)
					)}
				</div>
				<button
					type="button"
					onClick={() => onLaunch(item)}
					disabled={!hasPromptId}
					className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
					title={
						hasPromptId
							? "Générer le livrable"
							: "Prompt non disponible dans la bibliothèque"
					}
				>
					<Play className="w-3.5 h-3.5" />
					Lancer
				</button>
			</div>
		</div>
	);
}

function ModuleLivrableDrawer({
	open,
	item,
	raisonSociale,
	isPending,
	livrable,
	error,
	archived,
	onClose,
	onArchive,
	onExport,
}: {
	readonly open: boolean;
	readonly item: CatalogItem | null;
	readonly raisonSociale: string;
	readonly isPending: boolean;
	readonly livrable: ExecuteModuleResponse | null;
	readonly error: unknown;
	readonly archived: boolean;
	readonly onClose: () => void;
	readonly onArchive: (markdown: string, item: CatalogItem) => void;
	readonly onExport: (format: "pdf" | "docx", markdown: string) => void;
}) {
	const [copied, setCopied] = useState(false);
	if (!open || !item) return null;

	const markdown = livrable?.markdown ?? "";

	const handleCopy = async () => {
		if (!markdown) return;
		try {
			await navigator.clipboard.writeText(markdown);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* presse-papier indisponible — silencieux */
		}
	};

	// Rendu du corps du drawer — if/else plutôt que ternaires imbriquées.
	const renderDrawerBody = () => {
		if (isPending) {
			return (
				<div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
					<Loader2 className="w-6 h-6 animate-spin text-primary" />
					<p className="text-sm">Génération du livrable…</p>
					<p className="text-xs">L'IA rédige, cela peut prendre ~1 min.</p>
				</div>
			);
		}
		if (error) {
			return (
				<div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-600">
					<p className="font-semibold mb-1">Génération indisponible</p>
					<p className="text-xs leading-relaxed">
						{extractModuleError(error)}
					</p>
					<p className="text-[11px] text-muted-foreground mt-2">
						Vérifiez que la bibliothèque de prompts et le service IA sont
						disponibles (prérequis §1.4 du PLAN_PARITE).
					</p>
				</div>
			);
		}
		if (markdown) {
			return (
				<pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
					{markdown}
				</pre>
			);
		}
		return (
			<p className="text-sm text-muted-foreground italic">
				Aucun contenu renvoyé.
			</p>
		);
	};

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<div
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div className="relative w-full max-w-2xl h-full bg-background border-l border-border shadow-xl flex flex-col">
				<div className="flex items-center justify-between px-5 py-4 border-b border-border">
					<div className="min-w-0">
						<p className="text-xs font-bold uppercase tracking-widest text-primary">
							Livrable
						</p>
						<h3 className="text-base font-extrabold text-foreground truncate">
							{item.titre}
						</h3>
						<p className="text-xs text-muted-foreground truncate">
							{raisonSociale}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
						aria-label="Fermer"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-4">
					{renderDrawerBody()}
				</div>

				{!isPending && !error && markdown && (
					<div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-border">
						<button
							type="button"
							onClick={handleCopy}
							className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent"
						>
							<Copy className="w-3.5 h-3.5" />
							{copied ? "Copié !" : "Copier"}
						</button>
						<button
							type="button"
							onClick={() =>
								downloadModuleMarkdown(
									markdown,
									`${item.id}-${new Date().toISOString().slice(0, 10)}.md`,
								)
							}
							className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent"
						>
							<Download className="w-3.5 h-3.5" />
							.md
						</button>
						<button
							type="button"
							onClick={() => onExport("pdf", markdown)}
							className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent"
						>
							<Download className="w-3.5 h-3.5" />
							PDF
						</button>
						<button
							type="button"
							onClick={() => onExport("docx", markdown)}
							className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent"
						>
							<Download className="w-3.5 h-3.5" />
							Word
						</button>
						<button
							type="button"
							onClick={() => onArchive(markdown, item)}
							disabled={archived}
							className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
						>
							{archived ? "Archivé" : "Archiver dans Documents"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

function TabRecommandations({
	siren,
	identite,
	raisonSociale,
	onLaunchModule,
}: {
	readonly siren: string;
	readonly identite: Identite;
	readonly raisonSociale: string;
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

function TabDocuments({ siren }: { readonly siren: string }) {
	const { data: docs, isLoading } = useDocuments(siren);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-bold text-foreground">Documents</h2>
			</div>

			{isLoading && <LoadingSpinner />}
			{!isLoading && (docs ?? []).length === 0 && (
				<EmptyTab icon={FileText} title="Aucun document" />
			)}
			{!isLoading && (docs ?? []).length > 0 && (
				<div className="space-y-2">
					{(docs ?? []).slice(0, 15).map((d) => (
						<div
							key={d.id}
							className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-xl"
						>
							<FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-semibold text-foreground truncate">
									{d.title}
								</p>
								<p className="text-xs text-muted-foreground mt-0.5">
									{d.status}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Journal
// ---------------------------------------------------------------------------

function TabJournal({ siren }: { readonly siren: string }) {
	const { data, isLoading } = useJournalEvents({
		siren,
		size: 15,
		sort: "occurredAt,desc",
	});
	const events = data?.items ?? [];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-bold text-foreground">
					Journal d'activité
				</h2>
			</div>

			{isLoading && <LoadingSpinner />}
			{!isLoading && events.length === 0 && (
				<EmptyTab icon={BookOpen} title="Aucun événement dans le journal" />
			)}
			{!isLoading && events.length > 0 && (
				<div className="relative pl-4 border-l border-border/50 space-y-4">
					{events.map((e) => (
						<div key={e.id} className="relative">
							<div className="absolute -left-[21px] w-3 h-3 rounded-full bg-primary/30 border-2 border-background" />
							<div className="bg-card border border-border/50 rounded-xl p-3">
								<div className="flex items-center gap-2 mb-1">
									<span className="px-2 py-0.5 bg-muted/50 rounded-md text-xs font-medium text-muted-foreground">
										{e.kind}
									</span>
									<span className="text-xs text-muted-foreground ml-auto">
										{new Date(e.occurredAt).toLocaleString("fr-FR", {
											day: "2-digit",
											month: "short",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</div>
								<p className="text-sm font-semibold text-foreground">
									{e.title}
								</p>
								{e.content && (
									<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
										{e.content}
									</p>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Copilote
// ---------------------------------------------------------------------------

type CopilotSource = Record<string, unknown>;

interface CopilotChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	sources?: CopilotSource[];
	error?: boolean;
}

// Classe de la bulle de message du copilote selon l'auteur/l'état — table de
// correspondance plutôt que ternaires imbriquées.
function copilotBubbleClass(message: CopilotChatMessage): string {
	if (message.role === "user") return "bg-primary text-primary-foreground rounded-br-md";
	if (message.error) return "bg-red-500/10 text-red-600 border border-red-500/20 rounded-bl-md";
	return "bg-accent text-foreground rounded-bl-md";
}

function sourceLabel(src: CopilotSource): string {
	const label = src.label;
	if (typeof label === "string" && label) return label;
	const type = src.type;
	if (type === "module") return "Module";
	if (type === "tab") return "Onglet";
	return "Source";
}

function TabCopilote({
	siren,
	raisonSociale,
	goTo,
}: {
	readonly siren: string;
	readonly raisonSociale: string;
	readonly goTo: (id: TabId, module?: string) => void;
}) {
	const converse = useCopilotConverse();
	const { data: health } = useCopilotHealth();
	const { data: analyses } = useAnalyses(siren);

	// Dernière analyse du SIREN : fournit le job_id et le métier détecté au copilote
	// pour qu'il charge le contexte riche (entreprise + modules + diagnostic).
	const lastAnalysis = (analyses ?? [])[0];
	const jobId = lastAnalysis?.job_id ?? undefined;
	const metierId = lastAnalysis?.detected_business_id ?? undefined;

	const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
	const [input, setInput] = useState("");

	const handleSend = async () => {
		const message = input.trim();
		if (!message || converse.isPending) return;

		const history: ConverseMessage[] = messages.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		setMessages((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: "user", content: message },
		]);
		setInput("");

		try {
			const reply = await converse.mutateAsync({
				message,
				history,
				job_id: jobId,
				metier_id: metierId,
				temperature: 0.4,
			});
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: reply.text,
					sources: reply.sources,
				},
			]);
		} catch (err) {
			const axiosErr = err as {
				response?: {
					data?: { error?: { message?: string } };
					statusText?: string;
				};
			};
			const msg =
				axiosErr?.response?.data?.error?.message ??
				axiosErr?.response?.statusText ??
				"Le copilote ne répond pas pour le moment.";
			setMessages((prev) => [
				...prev,
				{ id: crypto.randomUUID(), role: "assistant", content: msg, error: true },
			]);
		}
	};

	const onSourceClick = (src: CopilotSource) => {
		const type = src.type;
		if (type === "module") {
			const moduleId = src.moduleId;
			if (typeof moduleId === "string" && moduleId) goTo("modules", moduleId);
		} else if (type === "tab") {
			const tab = src.tab;
			if (typeof tab === "string" && tab) goTo(tab as TabId);
		}
	};

	let healthToneClass = "bg-red-500/10 text-red-600 border-red-500/20";
	let healthLabel = "Hors ligne";
	if (health?.ollama_reachable && !health?.mock) {
		healthToneClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
		healthLabel = "En ligne";
	} else if (health?.mock) {
		healthToneClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
		healthLabel = "Mode démo";
	}

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-sm font-semibold text-foreground flex items-center gap-2">
						<Bot className="w-4 h-4 text-primary" />
						Copilote IA — {raisonSociale}
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						Contexte : entreprise, métier détecté
						{metierId ? ` (${metierId})` : ""}, modules disponibles et dernière
						analyse. Les sources renvoyées ouvrent le module ou l'onglet
						pertinent.
					</p>
				</div>
				<span
					className={cn(
						"inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap",
						healthToneClass,
					)}
				>
					{healthLabel}
				</span>
			</div>

			<section className="flex flex-col bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden h-[480px]">
				<div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
					{messages.length === 0 ? (
						<div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
							<div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
								<Sparkles className="w-6 h-6 text-primary" />
							</div>
							<p className="text-sm font-medium text-foreground">
								Posez votre question
							</p>
							<p className="text-xs text-muted-foreground max-w-xs">
								Ex. « Comment améliorer mes ventes ? », « Quelles actions
								prioritaires ? »
							</p>
						</div>
					) : (
						messages.map((m) => (
							<div
								key={m.id}
								className={cn(
									"flex",
									m.role === "user" ? "justify-end" : "justify-start",
								)}
							>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
										copilotBubbleClass(m),
									)}
								>
									<p className="whitespace-pre-wrap">{m.content}</p>
									{m.role === "assistant" &&
										!m.error &&
										m.sources &&
										m.sources.length > 0 && (
											<div className="mt-2 flex flex-wrap gap-1.5">
												{m.sources.map((src) => (
													<button
														key={sourceLabel(src)}
														type="button"
														onClick={() => onSourceClick(src)}
														className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
													>
														<CircleDot className="w-3 h-3" />
														{sourceLabel(src)}
													</button>
												))}
											</div>
										)}
								</div>
							</div>
						))
					)}
					{converse.isPending && (
						<div className="flex justify-start">
							<div className="bg-accent text-foreground rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="w-4 h-4 animate-spin" />
								Le copilote réfléchit…
							</div>
						</div>
					)}
				</div>

				<div className="border-t border-border/50 p-2.5 flex items-center gap-2">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSend();
							}
						}}
						rows={1}
						placeholder="Écrivez votre message… (Entrée pour envoyer)"
						className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!input.trim() || converse.isPending}
						className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
						title="Envoyer"
					>
						<Send className="w-4 h-4" />
					</button>
				</div>
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Modules — catalogue modules/outils du métier détecté pour ce SIREN
// ---------------------------------------------------------------------------

// Bundles sectoriels B2B (Lot H — stratégie hybride). La détection NAF renvoie
// le métier artisan fin ; ces bundles restent sélectionnables manuellement pour
// élargir le catalogue au secteur. Les `id` correspondent exactement aux clés
// `profiles` de `pme_modules.json`.
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

function TabModules({
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

// ---------------------------------------------------------------------------
// Onglet Playbooks
// ---------------------------------------------------------------------------

function TabPlaybooks() {
	const navigate = useNavigate();
	return (
		<div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
			<div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
				<Workflow className="w-7 h-7" />
			</div>
			<div>
				<p className="text-sm font-semibold text-foreground">Playbooks</p>
				<p className="text-xs text-muted-foreground mt-1">
					Automatisations et workflows d'action pour cette entreprise.
				</p>
			</div>
			<button
				onClick={() => navigate("/playbooks")}
				className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
			>
				<Workflow className="w-4 h-4" />
				Gérer les playbooks
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Composants partagés
// ---------------------------------------------------------------------------

function StatusBadge({ statut }: { readonly statut: string }) {
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

function AxeRow({ axeKey, axe }: { readonly axeKey: string; readonly axe: ScoreAxe }) {
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

function IdentiteCard({
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

function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
			<Loader2 className="w-5 h-5 animate-spin text-primary" />
			<span className="text-sm">Chargement…</span>
		</div>
	);
}

function EmptyTab({
	icon: Icon,
	title,
	action,
}: {
	readonly icon: React.ElementType;
	readonly title: string;
	readonly action?: { label: string; onClick: () => void };
}) {
	return (
		<div className="flex flex-col items-center justify-center py-14 gap-4 text-center bg-card border border-border/50 rounded-2xl">
			<div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
				<Icon className="w-6 h-6 text-muted-foreground/50" />
			</div>
			<p className="text-sm text-muted-foreground">{title}</p>
			{action && (
				<button
					onClick={action.onClick}
					className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
				>
					<Plus className="w-3.5 h-3.5" />
					{action.label}
				</button>
			)}
		</div>
	);
}

function ErrorView({
	message,
	onBack,
}: {
	readonly message: string;
	readonly onBack?: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center min-h-64 gap-3 text-muted-foreground">
			<AlertTriangle className="w-8 h-8 text-destructive" />
			<p className="text-sm font-medium">{message}</p>
			{onBack && (
				<button
					onClick={onBack}
					className="text-xs text-primary hover:underline flex items-center gap-1"
				>
					<ArrowLeft className="w-3.5 h-3.5" /> Retour
				</button>
			)}
		</div>
	);
}
