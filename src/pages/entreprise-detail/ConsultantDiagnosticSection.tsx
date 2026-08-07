import { ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Circle, Clock, Eye, Lightbulb, Loader2, Minus, Play, Plus, RefreshCw, Rocket, Sparkles, Target, TrendingUp, Workflow } from "lucide-react";
import type {
	ConsultantKpi,
	ConsultantPlanEtape,
	ConsultantScenario,
	ContextualDiagnosticResponse,
} from "@/api/recommandations";
import { cn } from "@/lib/utils";
import { extractDiagnosticError } from "./helpers";

// Diagnostic consultant (Lot C) : score, KPIs, plan d'action et projection.
// Ses sous-composants ne servent qu'ici, ils restent donc dans ce module.


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

export function ConsultantDiagnosticSection({
	isPending,
	isError,
	error,
	data,
	onGenerate,
	onLaunchModule,
	onRefresh,
	isRefreshing,
}: {
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
