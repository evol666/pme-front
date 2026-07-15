import {
	Activity,
	BarChart3,
	Bell,
	Check,
	DatabaseZap,
	Eye,
	Gauge,
	Loader2,
	RefreshCw,
	ServerCog,
	X,
} from "lucide-react";
import { useState } from "react";

import {
	type AiAlert,
	type AiUsage,
	type AlertSeverity,
	type KpiSnapshot,
	type PmeHealth,
	parseAdminJsonObject,
	useAiAlerts,
	useAiUsages,
	useKpiSnapshots,
	usePatchAiAlert,
	usePmeHealth,
} from "@/api/admin";
import {
	type SireneImportStatus,
	useSireneImportStatus,
	useSireneStats,
	useStartSireneImport,
} from "@/api/sirene";
import { cn } from "@/lib/utils";

// Supervision (LOT observabilité IA/admin). Version Spring Boot.
// 4 onglets : Santé AI (/api/health, DTO interne snake_case, poll 30s) ·
// Alertes (/api/ai-alerts paginé, filtres severity/status, actions PATCH seen/acted/dismissed) ·
// KPIs (/api/kpi-snapshots) · Usage IA (/api/ai-usages paginé).

type TabKey = "health" | "alerts" | "kpis" | "usage" | "sirene";

const TABS: { key: TabKey; label: string; icon: typeof Activity }[] = [
	{ key: "health", label: "Santé AI", icon: ServerCog },
	{ key: "alerts", label: "Alertes", icon: Bell },
	{ key: "kpis", label: "KPIs", icon: Gauge },
	{ key: "usage", label: "Usage IA", icon: BarChart3 },
	{ key: "sirene", label: "Base Sirene", icon: DatabaseZap },
];

const SEVERITY_TONE: Record<AlertSeverity, string> = {
	INFO: "bg-sky-500/10 text-sky-600",
	LOW: "bg-emerald-500/10 text-emerald-600",
	MEDIUM: "bg-amber-500/10 text-amber-600",
	HIGH: "bg-orange-500/10 text-orange-600",
	CRITICAL: "bg-red-500/10 text-red-600",
};

const SEVERITY_FILTERS: { key: AlertSeverity | ""; label: string }[] = [
	{ key: "", label: "Toutes" },
	{ key: "CRITICAL", label: "Critiques" },
	{ key: "HIGH", label: "Hautes" },
	{ key: "MEDIUM", label: "Moyennes" },
	{ key: "LOW", label: "Basses" },
	{ key: "INFO", label: "Info" },
];

const ALERT_STATUS_FILTERS: { key: string; label: string }[] = [
	{ key: "", label: "Toutes" },
	{ key: "new", label: "Nouvelles" },
	{ key: "seen", label: "Vues" },
	{ key: "acted", label: "Traitées" },
	{ key: "dismissed", label: "Écartées" },
];

function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleString("fr-FR", {
			dateStyle: "medium",
			timeStyle: "short",
		});
	} catch {
		return "—";
	}
}

function extractBackendError(err: unknown): string {
	const axiosErr = err as {
		response?: { data?: { error?: { message?: string } }; statusText?: string };
	};
	return (
		axiosErr?.response?.data?.error?.message ??
		axiosErr?.response?.statusText ??
		"Une erreur est survenue. Réessayez."
	);
}

export default function SupervisionPage() {
	const [tab, setTab] = useState<TabKey>("health");

	return (
		<div className="space-y-8">
			<header className="space-y-3">
				<p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
					<Activity className="h-4 w-4" />
					Supervision
				</p>
				<h1 className="text-3xl font-bold tracking-tight text-foreground">
					Supervision & observabilité
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					État de l’IA locale, alertes proactives, indicateurs clés et
					consommation des modèles. Données issues du backend Spring Boot.
				</p>
			</header>

			<nav className="flex flex-wrap gap-1 border-b border-border">
				{TABS.map((t) => (
					<button
						key={t.key}
						type="button"
						onClick={() => setTab(t.key)}
						className={cn(
							"inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
							tab === t.key
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						<t.icon className="h-4 w-4" />
						{t.label}
					</button>
				))}
			</nav>

			{tab === "health" && <HealthTab />}
			{tab === "alerts" && <AlertsTab />}
			{tab === "kpis" && <KpisTab />}
			{tab === "usage" && <UsageTab />}
			{tab === "sirene" && <SireneTab />}
		</div>
	);
}

// --- Base Sirene (import INSEE) ---

const SIRENE_PHASE_LABEL: Record<string, string> = {
	idle: "En attente",
	downloading: "Téléchargement du stock INSEE…",
	parsing: "Parsing & upsert…",
	done: "Terminé",
	error: "Erreur",
};

function SireneTab() {
	const { data: status } = useSireneImportStatus();
	const { data: stats } = useSireneStats();
	const start = useStartSireneImport();
	const running = status?.running ?? false;

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-base font-bold text-foreground">
							Import de la base Sirene
						</h2>
						<p className="mt-1 text-sm text-muted-foreground max-w-xl">
							Télécharge le stock mensuel des unités légales (INSEE /
							data.gouv.fr) et le met à jour en base. Plusieurs millions de
							lignes — l’opération tourne en arrière-plan. Un import mensuel
							automatique est également planifié.
						</p>
					</div>
					<button
						type="button"
						disabled={running || start.isPending}
						onClick={() => start.mutate()}
						className={cn(
							"inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
							running || start.isPending
								? "bg-muted text-muted-foreground cursor-not-allowed"
								: "bg-primary text-primary-foreground hover:opacity-90",
						)}
					>
						{running || start.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<DatabaseZap className="h-4 w-4" />
						)}
						{running ? "Import en cours…" : "Lancer l’import"}
					</button>
				</div>

				{start.isError && (
					<ErrorBanner message={extractBackendError(start.error)} />
				)}

				{status && status.phase !== "idle" && (
					<SireneProgress status={status} />
				)}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<StatCard label="Unités actives" value={stats?.actives} />
				<StatCard label="Unités cessées" value={stats?.cessees} />
				<StatCard label="Total en base" value={stats?.total} />
			</div>
		</div>
	);
}

function SireneProgress({ status }: { readonly status: SireneImportStatus }) {
	return (
		<div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
			<div className="flex items-center gap-2 font-medium text-foreground">
				{status.running && (
					<Loader2 className="h-4 w-4 animate-spin text-primary" />
				)}
				{SIRENE_PHASE_LABEL[status.phase] ?? status.phase}
			</div>
			<div className="grid grid-cols-3 gap-2 text-muted-foreground">
				<span>
					Lignes traitées : {status.processed.toLocaleString("fr-FR")}
				</span>
				<span>Upsertées : {status.upserted.toLocaleString("fr-FR")}</span>
				<span>Ignorées : {status.skipped.toLocaleString("fr-FR")}</span>
			</div>
			{status.startedAt && (
				<p className="text-xs text-muted-foreground">
					Démarré : {formatDateTime(status.startedAt)}
					{status.finishedAt
						? ` · Terminé : ${formatDateTime(status.finishedAt)}`
						: ""}
				</p>
			)}
			{status.error && <ErrorBanner message={status.error} />}
		</div>
	);
}

function StatCard({
	label,
	value,
}: {
	readonly label: string;
	readonly value: number | undefined;
}) {
	return (
		<div className="rounded-xl border border-border bg-card p-4 shadow-sm">
			<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 text-2xl font-bold text-foreground">
				{value === undefined ? "—" : value.toLocaleString("fr-FR")}
			</p>
		</div>
	);
}

// --- Santé AI ---

function HealthTab() {
	const { data: health, isLoading, isFetching, refetch } = usePmeHealth();

	if (isLoading) return <LoadingState label="Récupération de l’état IA…" />;
	if (!health) {
		return (
			<EmptyState
				icon={ServerCog}
				title="État indisponible"
				hint="L’endpoint /api/health n’a pas répondu. Réessayez."
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Rafraîchi automatiquement toutes les 30 secondes.
				</p>
				<button
					type="button"
					onClick={() => refetch()}
					className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
					Actualiser
				</button>
			</div>
			<HealthCard health={health} />
		</div>
	);
}

// Couleur du statut Ollama — if/else plutôt que ternaires imbriquées.
function ollamaToneClass(status: string): string {
	if (status === "ready") return "bg-emerald-500/10 text-emerald-600";
	if (status === "model_missing" || status === "unreachable")
		return "bg-red-500/10 text-red-600";
	return "bg-muted text-muted-foreground";
}

function HealthCard({ health }: { readonly health: PmeHealth }) {
	const ollamaTone = ollamaToneClass(health.ollama_status);
	const backendTone =
		health.backend_status === "UP" || health.backend_status === "ok"
			? "bg-emerald-500/10 text-emerald-600"
			: "bg-amber-500/10 text-amber-600";

	return (
		<article className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
			<div className="grid gap-3 sm:grid-cols-2">
				<StatusPill
					label="Backend"
					value={health.backend_status}
					tone={backendTone}
				/>
				<StatusPill
					label="Ollama (IA locale)"
					value={health.ollama_status}
					tone={ollamaTone}
				/>
			</div>
			<dl className="grid gap-3 sm:grid-cols-2">
				<div className="rounded-lg border border-border bg-background p-3">
					<dt className="text-xs text-muted-foreground">Modèle</dt>
					<dd className="mt-1 font-mono text-sm text-foreground">
						{health.model ?? "—"}
					</dd>
				</div>
				<div className="rounded-lg border border-border bg-background p-3">
					<dt className="text-xs text-muted-foreground">IA locale prête</dt>
					<dd className="mt-1 text-sm font-medium text-foreground">
						{health.local_ai_ready ? "Oui" : "Non"}
					</dd>
				</div>
			</dl>
			{health.user_message && (
				<p className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
					{health.user_message}
				</p>
			)}
		</article>
	);
}

function StatusPill({
	label,
	value,
	tone,
}: {
	readonly label: string;
	readonly value: string;
	readonly tone: string;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span
				className={cn("rounded-full px-2.5 py-1 text-xs font-medium", tone)}
			>
				{value}
			</span>
		</div>
	);
}

// --- Alertes ---

function AlertsTab() {
	const [severity, setSeverity] = useState<AlertSeverity | "">("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState<string | null>(null);

	const { data, isLoading, isFetching, refetch } = useAiAlerts(
		severity || undefined,
		status || undefined,
	);
	const patchMutation = usePatchAiAlert();
	const alerts = data?.content ?? [];

	const patch = async (alert: AiAlert, body: Partial<AiAlert>) => {
		setError(null);
		try {
			await patchMutation.mutateAsync({ id: alert.id, ...body });
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium text-foreground">
						Sévérité :
					</span>
					{SEVERITY_FILTERS.map((f) => (
						<FilterChip
							key={f.key || "all-sev"}
							active={severity === f.key}
							label={f.label}
							onClick={() => setSeverity(f.key)}
						/>
					))}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium text-foreground">Statut :</span>
					{ALERT_STATUS_FILTERS.map((f) => (
						<FilterChip
							key={f.key || "all-st"}
							active={status === f.key}
							label={f.label}
							onClick={() => setStatus(f.key)}
						/>
					))}
					<button
						type="button"
						onClick={() => refetch()}
						className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<RefreshCw
							className={cn("h-4 w-4", isFetching && "animate-spin")}
						/>
						Actualiser
					</button>
				</div>
			</div>

			{error && <ErrorBanner message={error} />}

			{isLoading && <LoadingState label="Chargement des alertes…" />}
			{!isLoading && alerts.length === 0 && (
				<EmptyState
					icon={Bell}
					title="Aucune alerte"
					hint="Aucune alerte ne correspond aux filtres, ou toutes ont été traitées."
				/>
			)}
			{!isLoading && alerts.length > 0 && (
				<div className="space-y-3">
					{alerts.map((a) => (
						<AlertCard
							key={a.id}
							alert={a}
							busy={
								patchMutation.isPending && patchMutation.variables?.id === a.id
							}
							onSeen={() =>
								patch(a, { status: "seen", seenAt: new Date().toISOString() })
							}
							onActed={() =>
								patch(a, { status: "acted", actedAt: new Date().toISOString() })
							}
							onDismiss={() =>
								patch(a, {
									status: "dismissed",
									dismissedAt: new Date().toISOString(),
								})
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// Libellé de statut d'une alerte — if/else plutôt que ternaires imbriquées.
function alertStatusLabel(acted: boolean, dismissed: boolean, status: string): string {
	if (acted) return "Traitée";
	if (dismissed) return "Écartée";
	return status;
}

function AlertCard({
	alert,
	busy,
	onSeen,
	onActed,
	onDismiss,
}: {
	readonly alert: AiAlert;
	readonly busy: boolean;
	readonly onSeen: () => void;
	readonly onActed: () => void;
	readonly onDismiss: () => void;
}) {
	const acted = alert.status === "acted";
	const dismissed = alert.status === "dismissed";

	return (
		<article
			className={cn(
				"rounded-2xl border bg-card p-5 shadow-sm space-y-3",
				dismissed ? "border-border opacity-70" : "border-border",
			)}
		>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
								SEVERITY_TONE[alert.severity],
							)}
						>
							{alert.severity}
						</span>
						<span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
							{alert.kind}
						</span>
						<span className="text-xs text-muted-foreground">
							{alertStatusLabel(acted, dismissed, alert.status)}
						</span>
						<span className="text-xs text-muted-foreground">#{alert.id}</span>
					</div>
					<h3 className="text-base font-semibold text-foreground">
						{alert.title ?? alert.kind}
					</h3>
					{alert.summary && (
						<p className="text-sm text-muted-foreground line-clamp-3">
							{alert.summary}
						</p>
					)}
				</div>
				<div className="flex flex-wrap gap-1.5">
					<ActionButton
						icon={Eye}
						label="Vue"
						onClick={onSeen}
						disabled={busy || !!alert.seenAt}
					/>
					<ActionButton
						icon={Check}
						label="Traiter"
						onClick={onActed}
						disabled={busy || acted}
						tone="primary"
					/>
					<ActionButton
						icon={X}
						label="Écarter"
						onClick={onDismiss}
						disabled={busy || dismissed}
						tone="destructive"
					/>
				</div>
			</header>

			{alert.suggestedAction && (
				<p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
					<span className="font-medium">Action suggérée : </span>
					{alert.suggestedAction}
				</p>
			)}

			<dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
				<Field
					label="Confiance"
					value={`${Math.round((alert.confidence ?? 0) * 100)}%`}
				/>
				<Field label="Créée" value={formatDateTime(alert.createdAt)} />
				<Field label="Vue" value={formatDateTime(alert.seenAt)} />
				<Field label="Traitée" value={formatDateTime(alert.actedAt)} />
			</dl>

			{alert.relatedSiren && (
				<p className="text-xs text-muted-foreground">
					SIREN lié : {alert.relatedSiren}
				</p>
			)}
		</article>
	);
}

function ActionButton({
	icon: Icon,
	label,
	onClick,
	disabled,
	tone = "neutral",
}: {
	readonly icon: typeof Check;
	readonly label: string;
	readonly onClick: () => void;
	readonly disabled?: boolean;
	readonly tone?: "neutral" | "primary" | "destructive";
}) {
	const cls =
		tone === "primary"
			? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
			: tone === "destructive"
				? "border-destructive/40 text-destructive hover:bg-destructive/10"
				: "border-border text-foreground hover:bg-accent";
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
				cls,
			)}
		>
			<Icon className="h-3.5 w-3.5" />
			{label}
		</button>
	);
}

function Field({ label, value }: { readonly label: string; readonly value: string }) {
	return (
		<div>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="mt-0.5 text-foreground">{value}</dd>
		</div>
	);
}

function FilterChip({
	active,
	label,
	onClick,
}: {
	readonly active: boolean;
	readonly label: string;
	readonly onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-lg px-3 py-1.5 text-sm font-medium transition",
				active
					? "bg-primary text-primary-foreground shadow-sm"
					: "text-muted-foreground hover:bg-accent hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

// --- KPIs ---

function KpisTab() {
	const [kpi, setKpi] = useState("");
	const [granularity, setGranularity] = useState("");
	const { data, isLoading, isFetching, refetch } = useKpiSnapshots(
		kpi || undefined,
		granularity || undefined,
	);

	const kpiNames = Array.from(new Set((data ?? []).map((k) => k.kpi))).sort(
		(a, b) => a.localeCompare(b),
	);

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<label className="flex-1 space-y-1.5">
						<span className="text-sm font-medium text-foreground">
							Indicateur
						</span>
						<input
							type="text"
							value={kpi}
							onChange={(e) => setKpi(e.target.value)}
							placeholder="ex. analyses_count"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</label>
					<label className="space-y-1.5">
						<span className="text-sm font-medium text-foreground">
							Granularité
						</span>
						<input
							type="text"
							value={granularity}
							onChange={(e) => setGranularity(e.target.value)}
							placeholder="day, month…"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
						/>
					</label>
					<button
						type="button"
						onClick={() => refetch()}
						className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<RefreshCw
							className={cn("h-4 w-4", isFetching && "animate-spin")}
						/>
						Actualiser
					</button>
				</div>
				{kpiNames.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{kpiNames.map((name) => (
							<button
								key={name}
								type="button"
								onClick={() => setKpi(name)}
								className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
							>
								{name}
							</button>
						))}
					</div>
				)}
			</div>

			{isLoading ? (
				<LoadingState label="Chargement des KPIs…" />
			) : !data || data.length === 0 ? (
				<EmptyState
					icon={Gauge}
					title="Aucun KPI"
					hint="Aucun instantané enregistré."
				/>
			) : (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{data.map((k) => (
						<KpiCard key={k.id} kpi={k} />
					))}
				</div>
			)}
		</div>
	);
}

function KpiCard({ kpi }: { readonly kpi: KpiSnapshot }) {
	const delta =
		kpi.valuePrev != null
			? ((kpi.value - kpi.valuePrev) / (kpi.valuePrev || 1)) * 100
			: null;
	const meta = parseAdminJsonObject(kpi.metadataJson);

	return (
		<article className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
			<div className="flex items-center justify-between">
				<span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
					<Gauge className="h-3 w-3" />
					{kpi.granularity}
				</span>
				{delta != null && (
					<span
						className={cn(
							"text-xs font-medium",
							delta >= 0 ? "text-emerald-600" : "text-red-600",
						)}
					>
						{delta >= 0 ? "+" : ""}
						{delta.toFixed(1)}%
					</span>
				)}
			</div>
			<h3 className="font-mono text-sm font-semibold text-foreground">
				{kpi.kpi}
			</h3>
			<p className="text-3xl font-bold tracking-tight text-foreground">
				{kpi.value.toLocaleString("fr-FR")}
			</p>
			<dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
				<Field label="Période début" value={formatDateTime(kpi.periodStart)} />
				<Field label="Période fin" value={formatDateTime(kpi.periodEnd)} />
				<Field
					label="Précédent"
					value={kpi.valuePrev?.toLocaleString("fr-FR") ?? "—"}
				/>
				<Field label="Créé" value={formatDateTime(kpi.createdAt)} />
			</dl>
			{meta && (
				<pre className="overflow-x-auto rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground">
					{JSON.stringify(meta, null, 2)}
				</pre>
			)}
		</article>
	);
}

// --- Usage IA ---

function UsageTab() {
	const [provider, setProvider] = useState("");
	const [status, setStatus] = useState("");
	const { data, isLoading, isFetching, refetch } = useAiUsages(
		provider || undefined,
		status || undefined,
	);
	const usages = data?.content ?? [];

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<label className="flex-1 space-y-1.5">
						<span className="text-sm font-medium text-foreground">
							Provider
						</span>
						<input
							type="text"
							value={provider}
							onChange={(e) => setProvider(e.target.value)}
							placeholder="ollama, openai…"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</label>
					<label className="space-y-1.5">
						<span className="text-sm font-medium text-foreground">Statut</span>
						<input
							type="text"
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							placeholder="ok, error…"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
						/>
					</label>
					<button
						type="button"
						onClick={() => refetch()}
						className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<RefreshCw
							className={cn("h-4 w-4", isFetching && "animate-spin")}
						/>
						Actualiser
					</button>
				</div>
			</div>

			{isLoading ? (
				<LoadingState label="Chargement de l’usage IA…" />
			) : usages.length === 0 ? (
				<EmptyState
					icon={BarChart3}
					title="Aucune consommation"
					hint="Aucun appel modèle enregistré ne correspond aux filtres."
				/>
			) : (
				<div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
					<table className="w-full text-sm">
						<thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
							<tr>
								<th className="px-4 py-3">Provider</th>
								<th className="px-4 py-3">Modèle</th>
								<th className="px-4 py-3">Statut</th>
								<th className="px-4 py-3 text-right">Tokens</th>
								<th className="px-4 py-3 text-right">Latence</th>
								<th className="px-4 py-3 text-right">Coût µUSD</th>
								<th className="px-4 py-3">Créé</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{usages.map((u) => (
								<UsageRow key={u.id} usage={u} />
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function UsageRow({ usage }: { readonly usage: AiUsage }) {
	const statusTone =
		usage.status === "ok" || usage.status === "success"
			? "bg-emerald-500/10 text-emerald-600"
			: usage.status === "error" || usage.status === "failed"
				? "bg-red-500/10 text-red-600"
				: "bg-muted text-muted-foreground";
	return (
		<tr className="hover:bg-accent/40">
			<td className="px-4 py-3 font-medium text-foreground">
				{usage.provider}
			</td>
			<td className="px-4 py-3 font-mono text-xs text-foreground">
				{usage.model}
			</td>
			<td className="px-4 py-3">
				<span
					className={cn(
						"rounded-full px-2 py-0.5 text-xs font-medium",
						statusTone,
					)}
				>
					{usage.status}
				</span>
			</td>
			<td className="px-4 py-3 text-right tabular-nums text-foreground">
				{usage.totalTokens ?? "—"}
			</td>
			<td className="px-4 py-3 text-right tabular-nums text-foreground">
				{usage.latencyMs != null ? `${usage.latencyMs} ms` : "—"}
			</td>
			<td className="px-4 py-3 text-right tabular-nums text-foreground">
				{usage.estimatedCostMicroUsd?.toLocaleString("fr-FR") ?? "—"}
			</td>
			<td className="px-4 py-3 text-xs text-muted-foreground">
				{formatDateTime(usage.createdAt)}
			</td>
		</tr>
	);
}

// --- États partagés ---

function ErrorBanner({ message }: { readonly message: string }) {
	return (
		<div
			role="alert"
			className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
		>
			{message}
		</div>
	);
}

function LoadingState({ label }: { readonly label: string }) {
	return (
		<div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
			<Loader2 className="mr-2 h-5 w-5 animate-spin" />
			{label}
		</div>
	);
}

function EmptyState({
	icon: Icon,
	title,
	hint,
}: {
	readonly icon: typeof Activity;
	readonly title: string;
	readonly hint: string;
}) {
	return (
		<div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
			<Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
			<p className="text-sm font-medium text-foreground">{title}</p>
			<p className="mt-1 text-sm text-muted-foreground">{hint}</p>
		</div>
	);
}
