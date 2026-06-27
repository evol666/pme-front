import {
	AlertTriangle,
	ArrowLeft,
	BarChart3,
	Blocks,
	BookOpen,
	Bot,
	Building2,
	Calendar,
	CheckCircle2,
	ChevronRight,
	CircleDot,
	Copy,
	Download,
	FileText,
	LayoutGrid,
	Lightbulb,
	Loader2,
	MapPin,
	Play,
	Plus,
	RefreshCw,
	Send,
	Sparkles,
	TrendingUp,
	Users,
	Workflow,
	X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAnalyses, useLaunchAnalysis } from "@/api/analyses";
import {
	type ConverseMessage,
	useCopilotConverse,
	useCopilotHealth,
} from "@/api/copilot";
import { useDocuments, useUploadDocumentDirect } from "@/api/documents";
import {
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
} from "@/api/recommandations";
import { cn } from "@/lib/utils";
import { libelleTrancheEffectif } from "@/lib/trancheEffectif";

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

const TABS = [
	{ id: "identite", label: "Identité", icon: Building2 },
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

export default function EntrepriseDetailPage() {
	const { siren } = useParams<{ siren: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const activeTab = (searchParams.get("tab") ?? "identite") as TabId;
	const activeModule = searchParams.get("module");

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

	const { data: enriched, isLoading, isError } = useEntreprise(siren);
	const { data: portefeuille } = usePortefeuilleEntreprise(siren);
	const refresh = useRefreshEntreprise();

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
					className={cn(
						"h-1.5",
						scoring?.severity === "faible"
							? "bg-emerald-500"
							: scoring?.severity === "modéré"
								? "bg-amber-400"
								: scoring
									? "bg-red-500"
									: "bg-muted",
					)}
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
								{identite.date_creation && (
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
										scoring.severity === "faible"
											? "bg-emerald-500/10 text-emerald-600"
											: scoring.severity === "modéré"
												? "bg-amber-500/10 text-amber-500"
												: "bg-red-500/10 text-red-500",
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
				{activeTab === "analyses" && <TabAnalyses siren={siren} goTo={goTo} />}
				{activeTab === "recommandations" && (
					<TabRecommandations
						siren={siren}
						identite={identite}
						raisonSociale={identite.raison_sociale ?? siren}
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
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Identité
// ---------------------------------------------------------------------------

function TabIdentite({
	enriched,
}: {
	enriched: import("@/api/entreprises").EntrepriseEnrichie;
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
						{identite.dirigeants.map((d, i) => (
							<div
								key={i}
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
					{bodacc.evenements.slice(0, 5).map((ev, i) => (
						<div
							key={i}
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

function ConsultantDiagnosticSection({
	siren,
	isPending,
	isError,
	error,
	data,
	onGenerate,
	onLaunchModule,
}: {
	siren: string;
	isPending: boolean;
	isError: boolean;
	error: unknown;
	data: ContextualDiagnosticResponse | undefined;
	onGenerate: () => void;
	onLaunchModule: () => void;
}) {
	const diag = data?.diagnostic;
	const delta = diag ? diag.scoreGlobal - diag.scorePrecedent : 0;

	return (
		<div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-sm font-bold text-foreground flex items-center gap-2">
						<Lightbulb className="w-4 h-4 text-primary" />
						Diagnostic consultant
					</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						Évaluation orientée métier
						{data?.metierId ? ` (${data.metierId})` : ""} pour {siren}.
					</p>
				</div>
				<button
					type="button"
					onClick={onGenerate}
					disabled={isPending}
					className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
				>
					{isPending ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : (
						<Sparkles className="w-3.5 h-3.5" />
					)}
					{diag ? "Régénérer" : "Générer le diagnostic"}
				</button>
			</div>

			{isError && (
				<p className="text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
					{extractDiagnosticError(error)}
				</p>
			)}

			{diag && (
				<>
					{/* Score + variation */}
					<div className="flex items-center gap-4">
						<div className="flex items-baseline gap-1.5">
							<span className="text-3xl font-extrabold text-foreground">
								{diag.scoreGlobal}
							</span>
							<span className="text-sm text-muted-foreground">/100</span>
						</div>
						{delta !== 0 && (
							<span
								className={cn(
									"inline-flex items-center gap-1 text-xs font-bold",
									delta > 0 ? "text-emerald-600" : "text-red-600",
								)}
							>
								<TrendingUp
									className={cn("w-3.5 h-3.5", delta < 0 && "rotate-180")}
								/>
								{delta > 0 ? "+" : ""}
								{delta} vs précédent
							</span>
						)}
					</div>

					<p className="text-sm text-foreground leading-relaxed">
						{diag.diagnostic}
					</p>

					{/* KPIs interprétés */}
					{diag.kpis.length > 0 && (
						<div className="space-y-2">
							<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
								Indicateurs clés
							</p>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
								{diag.kpis.map((k, i) => (
									<div
										key={i}
										className="bg-muted/30 border border-border/40 rounded-lg p-3 space-y-1"
									>
										<div className="flex items-center justify-between gap-2">
											<span className="text-xs font-semibold text-foreground truncate">
												{k.label}
											</span>
											<span
												className={cn(
													"text-xs font-bold",
													TREND_TONE[k.tendance?.toLowerCase()] ??
														"text-foreground",
												)}
											>
												{k.valeur}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
											{k.interpretation}
										</p>
										{k.recommandation && (
											<p className="text-[11px] text-primary font-medium line-clamp-2">
												{k.recommandation}
											</p>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Action prioritaire */}
					{diag.actionPrioritaireDefault && (
						<div className="bg-primary/5 border border-primary/30 rounded-xl p-4 space-y-2">
							<p className="text-[10px] font-bold uppercase tracking-wider text-primary">
								Action prioritaire
							</p>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="text-sm font-bold text-foreground">
										{diag.actionPrioritaireDefault.titre}
									</p>
									<p className="text-xs text-muted-foreground mt-1 leading-relaxed">
										{diag.actionPrioritaireDefault.description}
									</p>
									{diag.actionPrioritaireDefault.duree && (
										<p className="text-[11px] text-muted-foreground mt-1">
											Durée : {diag.actionPrioritaireDefault.duree}
										</p>
									)}
								</div>
								<button
									type="button"
									onClick={onLaunchModule}
									className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 whitespace-nowrap flex-shrink-0"
								>
									<Sparkles className="w-3.5 h-3.5" />
									Lancer
								</button>
							</div>
						</div>
					)}

					{/* Plan d'action */}
					{diag.plan.length > 0 && (
						<div className="space-y-2">
							<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
								Plan d'action
							</p>
							<ol className="space-y-2">
								{diag.plan.map((etape, i) => (
									<li
										key={i}
										className="bg-muted/30 border border-border/40 rounded-lg p-3"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0 space-y-1">
												<div className="flex items-center gap-2">
													<span className="text-[10px] font-bold text-primary">
														Étape {i + 1}
													</span>
													{etape.statut && (
														<span className="text-[10px] font-medium text-muted-foreground">
															{etape.statut}
														</span>
													)}
													{etape.echeance && (
														<span className="text-[10px] text-muted-foreground">
															· {etape.echeance}
														</span>
													)}
												</div>
												<p className="text-sm font-semibold text-foreground">
													{etape.titre}
												</p>
												{etape.impact && (
													<p className="text-[11px] text-muted-foreground">
														Impact : {etape.impact}
													</p>
												)}
											</div>
											{etape.cta && (
												<button
													type="button"
													onClick={onLaunchModule}
													className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-primary/40 text-primary text-[11px] font-bold hover:bg-primary/10 whitespace-nowrap flex-shrink-0"
												>
													{etape.cta}
												</button>
											)}
										</div>
									</li>
								))}
							</ol>
						</div>
					)}

					{/* Projection 30 jours */}
					{diag.projection && (
						<div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
							<div className="bg-muted/30 border border-border/40 rounded-lg p-3">
								<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
									Visibilité actuelle
								</p>
								<p className="text-lg font-bold text-foreground mt-1">
									{diag.projection.visibiliteAvant}
								</p>
							</div>
							<div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-3">
								<p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
									Avec action
								</p>
								<p className="text-lg font-bold text-foreground mt-1">
									{diag.projection.avecAction.visibilite}
								</p>
								<p className="text-[11px] text-muted-foreground">
									{diag.projection.avecAction.opportunites} opportunités
								</p>
							</div>
							<div className="bg-muted/30 border border-border/40 rounded-lg p-3">
								<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
									Sans action
								</p>
								<p className="text-lg font-bold text-foreground mt-1">
									{diag.projection.sansAction.visibilite}
								</p>
								<p className="text-[11px] text-muted-foreground">
									{diag.projection.sansAction.opportunites} opportunités
								</p>
							</div>
						</div>
					)}
				</>
			)}

			{!diag && !isPending && !isError && (
				<p className="text-xs text-muted-foreground py-2">
					Générez le diagnostic consultant pour afficher l'action prioritaire,
					les KPI interprétés et le plan d'action orienté métier.
				</p>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Analyses
// ---------------------------------------------------------------------------

function TabAnalyses({
	siren,
	goTo,
}: {
	siren: string;
	goTo: (id: TabId, module?: string) => void;
}) {
	const navigate = useNavigate();
	const { data: analyses, isLoading, refetch, isFetching } = useAnalyses(siren);
	const launch = useLaunchAnalysis();
	const diagnostic = useContextualDiagnostic();
	const lastAnalysis = (analyses ?? [])[0];

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

	const STATUS_LABEL: Record<string, string> = {
		pending: "En attente",
		processing: "En cours",
		running: "En cours",
		completed: "Terminée",
		failed: "Échec",
		error: "Erreur",
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-bold text-foreground">Analyses IA</h2>
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

			{/* Diagnostic consultant contextuel (Lot C) — orienté métier détecté. */}
			<ConsultantDiagnosticSection
				siren={siren}
				isPending={diagnostic.isPending}
				isError={diagnostic.isError}
				error={diagnostic.error}
				data={diagnostic.data}
				onGenerate={handleGenerateDiagnostic}
				onLaunchModule={() => goTo("modules")}
			/>

			{isLoading ? (
				<LoadingSpinner />
			) : (analyses ?? []).length === 0 ? (
				<EmptyTab
					icon={BarChart3}
					title="Aucune analyse pour ce SIREN"
					action={{ label: "Lancer une analyse", onClick: handleLaunch }}
				/>
			) : (
				<div className="space-y-2">
					{(analyses ?? []).map((a) => (
						<button
							key={a.job_id}
							onClick={() => navigate(`/analyse?jobId=${a.job_id}`)}
							className="w-full flex items-center gap-4 p-4 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-all text-left"
						>
							<div
								className={cn(
									"flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold",
									a.status === "completed"
										? "bg-emerald-500/10 text-emerald-600"
										: ["failed", "error"].includes(a.status)
											? "bg-red-500/10 text-red-600"
											: "bg-primary/10 text-primary",
								)}
							>
								{STATUS_LABEL[a.status] ?? a.status}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-semibold text-foreground truncate">
									{a.company_name ?? siren}
								</p>
								{a.created_at && (
									<p className="text-xs text-muted-foreground mt-0.5">
										{new Date(a.created_at).toLocaleString("fr-FR")}
									</p>
								)}
							</div>
							{a.score != null && (
								<span className="text-sm font-bold text-foreground flex-shrink-0">
									{a.score}/100
								</span>
							)}
							<ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
						</button>
					))}
				</div>
			)}
		</div>
	);
}

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
		lignes.push(
			`Code NAF : ${identite.code_naf}${identite.libelle_naf ? ` — ${identite.libelle_naf}` : ""}`,
		);
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
	item: CatalogItem;
	variant: "module" | "tool";
	onLaunch: (item: CatalogItem) => void;
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
	open: boolean;
	item: CatalogItem | null;
	raisonSociale: string;
	isPending: boolean;
	livrable: ExecuteModuleResponse | null;
	error: unknown;
	archived: boolean;
	onClose: () => void;
	onArchive: (markdown: string, item: CatalogItem) => void;
	onExport: (format: "pdf" | "docx", markdown: string) => void;
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
					{isPending ? (
						<div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
							<Loader2 className="w-6 h-6 animate-spin text-primary" />
							<p className="text-sm">Génération du livrable…</p>
							<p className="text-xs">L'IA rédige, cela peut prendre ~1 min.</p>
						</div>
					) : error ? (
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
					) : markdown ? (
						<pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
							{markdown}
						</pre>
					) : (
						<p className="text-sm text-muted-foreground italic">
							Aucun contenu renvoyé.
						</p>
					)}
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
}: {
	siren: string;
	identite: Identite;
	raisonSociale: string;
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
	const execute = useExecuteModule();
	const upload = useUploadDocumentDirect();
	const exportMut = useExportDocument();

	const [running, setRunning] = useState<CatalogItem | null>(null);
	const [livrable, setLivrable] = useState<ExecuteModuleResponse | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [archived, setArchived] = useState(false);

	const modules = catalogue?.modules ?? [];
	const tools = catalogue?.tools ?? [];

	const handleLaunch = (item: CatalogItem) => {
		if (!item.prompt_id) return;
		setRunning(item);
		setLivrable(null);
		setArchived(false);
		setDrawerOpen(true);
		execute.mutate(
			{
				metier_id: metierId,
				prompt_id: item.prompt_id,
				contexte_entreprise: buildContexteEntreprise(
					identite,
					raisonSociale,
					siren,
					metier,
				),
				preferences: { style: "consultant", duree: item.duree },
			},
			{ onSuccess: (res) => setLivrable(res) },
		);
	};

	const handleArchive = (markdown: string, item: CatalogItem) => {
		const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
		const file = new File([blob], `${item.id}.md`, {
			type: "text/markdown;charset=utf-8",
		});
		upload.mutate(
			{
				file,
				title: `${item.titre} — ${raisonSociale}`,
				sourceKind: "module",
				siren,
			},
			{ onSuccess: () => setArchived(true) },
		);
	};

	const handleExport = (format: "pdf" | "docx", markdown: string) => {
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
					company_name: raisonSociale,
					metier_label: metier?.nom_metier,
				},
			},
		});
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
				{catLoading ? (
					<LoadingSpinner />
				) : modules.length === 0 && tools.length === 0 ? (
					<EmptyTab
						icon={LayoutGrid}
						title="Aucun module disponible pour ce métier"
					/>
				) : (
					<>
						{modules.length > 0 && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{modules.map((m) => (
									<ModuleCard
										key={m.id}
										item={m}
										variant="module"
										onLaunch={handleLaunch}
									/>
								))}
							</div>
						)}
						{tools.length > 0 && (
							<>
								<p className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">
									Outils réutilisables
								</p>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{tools.map((t) => (
										<ModuleCard
											key={t.id}
											item={t}
											variant="tool"
											onLaunch={handleLaunch}
										/>
									))}
								</div>
							</>
						)}
					</>
				)}
			</div>

			{/* Recommandations IA (existant) */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-bold text-foreground">
						Recommandations IA
					</h2>
				</div>

				{isLoading ? (
					<LoadingSpinner />
				) : filtered.length === 0 ? (
					<EmptyTab icon={Lightbulb} title="Aucune recommandation" />
				) : (
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
											r.priority <= 2
												? "bg-red-500/10 text-red-600"
												: r.priority <= 4
													? "bg-amber-500/10 text-amber-600"
													: "bg-muted text-muted-foreground",
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

			<ModuleLivrableDrawer
				open={drawerOpen}
				item={running}
				raisonSociale={raisonSociale}
				isPending={execute.isPending}
				livrable={livrable}
				error={execute.error}
				archived={archived}
				onClose={() => setDrawerOpen(false)}
				onArchive={handleArchive}
				onExport={handleExport}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Documents
// ---------------------------------------------------------------------------

function TabDocuments({ siren }: { siren: string }) {
	const { data: docs, isLoading } = useDocuments(siren);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-bold text-foreground">Documents</h2>
			</div>

			{isLoading ? (
				<LoadingSpinner />
			) : (docs ?? []).length === 0 ? (
				<EmptyTab icon={FileText} title="Aucun document" />
			) : (
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

function TabJournal({ siren }: { siren: string }) {
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

			{isLoading ? (
				<LoadingSpinner />
			) : events.length === 0 ? (
				<EmptyTab icon={BookOpen} title="Aucun événement dans le journal" />
			) : (
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
	role: "user" | "assistant";
	content: string;
	sources?: CopilotSource[];
	error?: boolean;
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
	siren: string;
	raisonSociale: string;
	goTo: (id: TabId, module?: string) => void;
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

		setMessages((prev) => [...prev, { role: "user", content: message }]);
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
				{ role: "assistant", content: msg, error: true },
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
						health?.ollama_reachable && !health?.mock
							? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
							: health?.mock
								? "bg-amber-500/10 text-amber-600 border-amber-500/20"
								: "bg-red-500/10 text-red-600 border-red-500/20",
					)}
				>
					{health?.mock
						? "Mode démo"
						: health?.ollama_reachable
							? "En ligne"
							: "Hors ligne"}
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
						messages.map((m, i) => (
							<div
								key={i}
								className={cn(
									"flex",
									m.role === "user" ? "justify-end" : "justify-start",
								)}
							>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
										m.role === "user"
											? "bg-primary text-primary-foreground rounded-br-md"
											: m.error
												? "bg-red-500/10 text-red-600 border border-red-500/20 rounded-bl-md"
												: "bg-accent text-foreground rounded-bl-md",
									)}
								>
									<p className="whitespace-pre-wrap">{m.content}</p>
									{m.role === "assistant" &&
										!m.error &&
										m.sources &&
										m.sources.length > 0 && (
											<div className="mt-2 flex flex-wrap gap-1.5">
												{m.sources.map((src, j) => (
													<button
														key={j}
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
	siren: string;
	activeModule: string | null;
	goTo: (id: TabId, module?: string) => void;
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
					<label className="text-xs text-muted-foreground">
						Élargir au secteur :
					</label>
					<select
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

function StatusBadge({ statut }: { statut: string }) {
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

function AxeRow({ axeKey, axe }: { axeKey: string; axe: ScoreAxe }) {
	const barColor =
		axe.score >= 70
			? "bg-emerald-500"
			: axe.score >= 40
				? "bg-amber-400"
				: "bg-red-400";

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
	identite: import("@/api/entreprises").Identite;
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
	icon: React.ElementType;
	title: string;
	action?: { label: string; onClick: () => void };
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
	message: string;
	onBack?: () => void;
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
