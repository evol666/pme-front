import {
	AlertTriangle,
	Boxes,
	Building2,
	Loader2,
	Network,
	Plus,
	RefreshCw,
	Search,
	ShieldCheck,
	Trash2,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
	type BusinessEntity,
	type Connection,
	type ConnectionStatus,
	type NetworkInsight,
	type NetworkSyncState,
	parseJsonObject,
	useBusinessEntities,
	useConnections,
	useCreateBusinessEntity,
	useDeleteBusinessEntity,
	useDeleteConnection,
	useDeleteNetworkInsight,
	useNetworkInsights,
	useNetworkSyncStates,
} from "@/api/network";
import { cn } from "@/lib/utils";

// Page « Réseau » (LOT cartographie business). Version Spring Boot : 4 onglets CRUD.
// L'ancien frontend visait un graphe entités↔entités non backend-isé → on se base sur
// le CRUD seul (BusinessEntity / Connection / NetworkInsight / NetworkSyncState).
// SÉCURITÉ : les tokens OAuth (Connection.accessToken/refreshToken) ne sont jamais
// affichés — seul un témoin de présence est montré.

type Tab = "entities" | "connections" | "insights" | "sync";

const TABS: { key: Tab; label: string; icon: typeof Network }[] = [
	{ key: "entities", label: "Entités", icon: Building2 },
	{ key: "connections", label: "Connexions", icon: Boxes },
	{ key: "insights", label: "Insights", icon: Zap },
	{ key: "sync", label: "Synchronisation", icon: RefreshCw },
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

export default function ReseauPage() {
	const [tab, setTab] = useState<Tab>("entities");

	return (
		<div className="space-y-8">
			<header className="space-y-3">
				<p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
					<Network className="h-4 w-4" />
					Réseau business
				</p>
				<h1 className="text-3xl font-bold tracking-tight text-foreground">
					Réseau
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Cartographie de votre écosystème : entités business (clients,
					fournisseurs, partenaires), connexions à des providers externes,
					insights réseau et état de synchronisation.
				</p>
			</header>

			<nav className="flex flex-wrap gap-2 border-b border-border">
				{TABS.map((t) => {
					const Icon = t.icon;
					return (
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
							<Icon className="h-4 w-4" />
							{t.label}
						</button>
					);
				})}
			</nav>

			{tab === "entities" && <EntitiesTab />}
			{tab === "connections" && <ConnectionsTab />}
			{tab === "insights" && <InsightsTab />}
			{tab === "sync" && <SyncTab />}
		</div>
	);
}

// --- Onglet Entités ---

function EntitiesTab() {
	const [search, setSearch] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");
	const [kindFilter, setKindFilter] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);

	const {
		data: entities,
		isLoading,
		refetch,
		isFetching,
	} = useBusinessEntities(kindFilter || undefined, appliedSearch || undefined);
	const createMutation = useCreateBusinessEntity();
	const deleteMutation = useDeleteBusinessEntity();

	const kinds = useMemo(() => {
		const set = new Set<string>();
		entities?.forEach((e) => set.add(e.kind));
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}, [entities]);

	const handleDelete = async (e: BusinessEntity) => {
		if (!globalThis.confirm(`Supprimer l’entité « ${e.label} » ?`)) return;
		setError(null);
		try {
			await deleteMutation.mutateAsync(e.id);
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
				<form
					onSubmit={(ev) => {
						ev.preventDefault();
						setAppliedSearch(search.trim());
					}}
					className="flex flex-col gap-3 sm:flex-row sm:items-end"
				>
					<label className="flex-1 space-y-1.5">
						<span className="text-sm font-medium text-foreground">
							Recherche
						</span>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="search"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Libellé de l’entité…"
								className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</label>
					<label className="space-y-1.5">
						<span className="text-sm font-medium text-foreground">Type</span>
						<select
							value={kindFilter}
							onChange={(e) => setKindFilter(e.target.value)}
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-44"
						>
							<option value="">Tous</option>
							{kinds.map((k) => (
								<option key={k} value={k}>
									{k}
								</option>
							))}
						</select>
					</label>
					<button
						type="submit"
						className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
					>
						Filtrer
					</button>
					<button
						type="button"
						onClick={() => refetch()}
						className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<RefreshCw
							className={cn("h-4 w-4", isFetching && "animate-spin")}
						/>
					</button>
					<button
						type="button"
						onClick={() => setShowForm((v) => !v)}
						className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<Plus className="h-4 w-4" />
						Ajouter
					</button>
				</form>

				{showForm && (
					<EntityForm
						onCreate={async (values) => {
							setError(null);
							try {
								await createMutation.mutateAsync(values);
								setShowForm(false);
							} catch (err) {
								setError(extractBackendError(err));
							}
						}}
						creating={createMutation.isPending}
					/>
				)}
			</div>

			{error && <ErrorBanner message={error} />}

			{isLoading && <LoadingState label="Chargement des entités…" />}
			{!isLoading && (!entities || entities.length === 0) && (
				<EmptyState
					icon={Building2}
					title="Aucune entité"
					hint="Ajoutez votre première entité business."
				/>
			)}
			{!isLoading && entities && entities.length > 0 && (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{entities.map((e) => (
						<EntityCard
							key={e.id}
							entity={e}
							onDelete={() => handleDelete(e)}
							deleting={
								deleteMutation.isPending && deleteMutation.variables === e.id
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function EntityForm({
	onCreate,
	creating,
}: {
	readonly onCreate: (values: {
		kind: string;
		label: string;
		externalRef?: string | null;
	}) => void;
	readonly creating: boolean;
}) {
	const [kind, setKind] = useState("client");
	const [label, setLabel] = useState("");
	const [externalRef, setExternalRef] = useState("");

	return (
		<form
			onSubmit={(ev) => {
				ev.preventDefault();
				if (!label.trim()) return;
				onCreate({
					kind: kind.trim() || "client",
					label: label.trim(),
					externalRef: externalRef.trim() || null,
				});
			}}
			className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-3"
		>
			<label className="space-y-1.5">
				<span className="text-xs font-medium text-foreground">Type</span>
				<input
					value={kind}
					onChange={(e) => setKind(e.target.value)}
					placeholder="client, fournisseur…"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>
			<label className="space-y-1.5">
				<span className="text-xs font-medium text-foreground">Libellé</span>
				<input
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="Nom de l’entité"
					required
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>
			<label className="space-y-1.5">
				<span className="text-xs font-medium text-foreground">
					Référence externe
				</span>
				<input
					value={externalRef}
					onChange={(e) => setExternalRef(e.target.value)}
					placeholder="SIRET, ID externe…"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</label>
			<div className="sm:col-span-3 flex justify-end">
				<button
					type="submit"
					disabled={creating || !label.trim()}
					className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring"
				>
					{creating && <Loader2 className="h-4 w-4 animate-spin" />}
					Créer l’entité
				</button>
			</div>
		</form>
	);
}

function EntityCard({
	entity,
	onDelete,
	deleting,
}: {
	readonly entity: BusinessEntity;
	readonly onDelete: () => void;
	readonly deleting: boolean;
}) {
	const attrs = useMemo(
		() => parseJsonObject(entity.attributes),
		[entity.attributes],
	);
	return (
		<article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
			<header className="flex items-center justify-between gap-2">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
					<Building2 className="h-3 w-3" />
					{entity.kind}
				</span>
				<button
					type="button"
					onClick={onDelete}
					disabled={deleting}
					aria-label={`Supprimer l’entité ${entity.label}`}
					className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
				>
					{deleting ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Trash2 className="h-3.5 w-3.5" />
					)}
				</button>
			</header>
			<h3 className="text-lg font-semibold text-foreground">{entity.label}</h3>
			{entity.externalRef && (
				<p className="text-xs text-muted-foreground">
					Réf. {entity.externalRef}
				</p>
			)}
			{attrs && (
				<dl className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs">
					{Object.entries(attrs)
						.slice(0, 5)
						.map(([k, v]) => (
							<div key={k} className="flex justify-between gap-2">
								<dt className="text-muted-foreground">{k}</dt>
								<dd className="truncate text-right text-foreground">
									{String(v)}
								</dd>
							</div>
						))}
				</dl>
			)}
			<p className="mt-auto text-xs text-muted-foreground">
				Créé le {formatDateTime(entity.createdAt)}
			</p>
		</article>
	);
}

// --- Onglet Connexions ---

const STATUS_TONE: Record<ConnectionStatus, string> = {
	CONNECTED: "bg-emerald-500/10 text-emerald-600",
	PENDING: "bg-sky-500/10 text-sky-600",
	ERROR: "bg-red-500/10 text-red-600",
	DISCONNECTED: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
	CONNECTED: "Connectée",
	PENDING: "En attente",
	ERROR: "Erreur",
	DISCONNECTED: "Déconnectée",
};

const STATUS_FILTERS: { key: ConnectionStatus | ""; label: string }[] = [
	{ key: "", label: "Toutes" },
	{ key: "CONNECTED", label: "Connectées" },
	{ key: "PENDING", label: "En attente" },
	{ key: "ERROR", label: "Erreurs" },
	{ key: "DISCONNECTED", label: "Déconnectées" },
];

function ConnectionsTab() {
	const [provider, setProvider] = useState("");
	const [statusFilter, setStatusFilter] = useState<ConnectionStatus | "">("");
	const [error, setError] = useState<string | null>(null);

	const {
		data: connections,
		isLoading,
		refetch,
		isFetching,
	} = useConnections(provider || undefined, statusFilter || undefined);
	const deleteMutation = useDeleteConnection();

	const handleDelete = async (c: Connection) => {
		if (!globalThis.confirm(`Supprimer la connexion ${c.provider} ?`)) return;
		setError(null);
		try {
			await deleteMutation.mutateAsync(c.id);
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<label className="flex-1 space-y-1.5">
						<span className="text-sm font-medium text-foreground">
							Provider
						</span>
						<input
							value={provider}
							onChange={(e) => setProvider(e.target.value)}
							placeholder="google, microsoft…"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
				<div className="flex flex-wrap gap-2">
					{STATUS_FILTERS.map((f) => (
						<button
							key={f.key || "all"}
							type="button"
							onClick={() => setStatusFilter(f.key)}
							className={cn(
								"rounded-lg px-3 py-1.5 text-sm font-medium transition",
								statusFilter === f.key
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:bg-accent hover:text-foreground",
							)}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{error && <ErrorBanner message={error} />}

			{isLoading && <LoadingState label="Chargement des connexions…" />}
			{!isLoading && (!connections || connections.length === 0) && (
				<EmptyState
					icon={Boxes}
					title="Aucune connexion"
					hint="Aucune connexion à un provider externe."
				/>
			)}
			{!isLoading && connections && connections.length > 0 && (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{connections.map((c) => (
						<ConnectionCard
							key={c.id}
							connection={c}
							onDelete={() => handleDelete(c)}
							deleting={
								deleteMutation.isPending && deleteMutation.variables === c.id
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ConnectionCard({
	connection,
	onDelete,
	deleting,
}: {
	readonly connection: Connection;
	readonly onDelete: () => void;
	readonly deleting: boolean;
}) {
	const hasTokens = Boolean(connection.accessToken || connection.refreshToken);
	return (
		<article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
			<header className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
						<Boxes className="h-3 w-3" />
						{connection.provider}
					</span>
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
							STATUS_TONE[connection.status],
						)}
					>
						{STATUS_LABEL[connection.status]}
					</span>
				</div>
				<button
					type="button"
					onClick={onDelete}
					disabled={deleting}
					aria-label={`Supprimer la connexion ${connection.provider}`}
					className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
				>
					{deleting ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Trash2 className="h-3.5 w-3.5" />
					)}
				</button>
			</header>

			<h3 className="text-lg font-semibold text-foreground">
				{connection.displayName ?? connection.provider}
			</h3>

			<dl className="space-y-1 text-xs text-muted-foreground">
				{connection.accountEmail && (
					<div className="flex justify-between gap-2">
						<dt>Compte</dt>
						<dd className="text-right text-foreground">
							{connection.accountEmail}
						</dd>
					</div>
				)}
				{connection.accountId && (
					<div className="flex justify-between gap-2">
						<dt>ID compte</dt>
						<dd className="text-right text-foreground">
							{connection.accountId}
						</dd>
					</div>
				)}
				<div className="flex justify-between gap-2">
					<dt>Dernière sync</dt>
					<dd className="text-right text-foreground">
						{formatDateTime(connection.lastSyncAt)}
					</dd>
				</div>
				<div className="flex justify-between gap-2">
					<dt>Token expire</dt>
					<dd className="text-right text-foreground">
						{formatDateTime(connection.tokenExpiresAt)}
					</dd>
				</div>
				<div className="flex justify-between gap-2">
					<dt className="flex items-center gap-1">
						<ShieldCheck className="h-3 w-3" /> Tokens
					</dt>
					<dd className="text-right text-foreground">
						{hasTokens ? "Présents (masqués)" : "Aucun"}
					</dd>
				</div>
			</dl>

			{connection.lastError && (
				<p className="inline-flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
					<span className="line-clamp-3">{connection.lastError}</span>
				</p>
			)}
		</article>
	);
}

// --- Onglet Insights ---

function InsightsTab() {
	const [kind, setKind] = useState("");
	const {
		data: insights,
		isLoading,
		refetch,
		isFetching,
	} = useNetworkInsights(kind || undefined);
	const deleteMutation = useDeleteNetworkInsight();
	const [error, setError] = useState<string | null>(null);

	const kinds = useMemo(() => {
		const set = new Set<string>();
		insights?.forEach((i) => set.add(i.kind));
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}, [insights]);

	const handleDelete = async (i: NetworkInsight) => {
		if (!globalThis.confirm(`Supprimer l’insight « ${i.title} » ?`)) return;
		setError(null);
		try {
			await deleteMutation.mutateAsync(i.id);
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
				<label className="flex-1 space-y-1.5">
					<span className="text-sm font-medium text-foreground">Type</span>
					<select
						value={kind}
						onChange={(e) => setKind(e.target.value)}
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
					>
						<option value="">Tous</option>
						{kinds.map((k) => (
							<option key={k} value={k}>
								{k}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					onClick={() => refetch()}
					className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
					Actualiser
				</button>
			</div>

			{error && <ErrorBanner message={error} />}

			{isLoading && <LoadingState label="Chargement des insights…" />}
			{!isLoading && (!insights || insights.length === 0) && (
				<EmptyState
					icon={Zap}
					title="Aucun insight"
					hint="Aucun insight réseau généré."
				/>
			)}
			{!isLoading && insights && insights.length > 0 && (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{insights.map((i) => (
						<InsightCard
							key={i.id}
							insight={i}
							onDelete={() => handleDelete(i)}
							deleting={
								deleteMutation.isPending && deleteMutation.variables === i.id
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function InsightCard({
	insight,
	onDelete,
	deleting,
}: {
	readonly insight: NetworkInsight;
	readonly onDelete: () => void;
	readonly deleting: boolean;
}) {
	return (
		<article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
			<header className="flex items-center justify-between gap-2">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
					<Zap className="h-3 w-3" />
					{insight.kind}
				</span>
				<div className="flex items-center gap-2">
					{insight.score != null && (
						<span className="text-xs font-medium text-foreground">
							Score {Math.round(insight.score)}
						</span>
					)}
					<button
						type="button"
						onClick={onDelete}
						disabled={deleting}
						aria-label={`Supprimer l’insight ${insight.title}`}
						className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
					>
						{deleting ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Trash2 className="h-3.5 w-3.5" />
						)}
					</button>
				</div>
			</header>
			<h3 className="text-lg font-semibold text-foreground">{insight.title}</h3>
			{insight.summary && (
				<p className="text-sm text-muted-foreground line-clamp-4">
					{insight.summary}
				</p>
			)}
			<p className="mt-auto text-xs text-muted-foreground">
				Créé le {formatDateTime(insight.createdAt)}
			</p>
		</article>
	);
}

// --- Onglet Sync ---

function SyncTab() {
	const {
		data: states,
		isLoading,
		refetch,
		isFetching,
	} = useNetworkSyncStates();
	return (
		<div className="space-y-4">
			<div className="flex justify-end rounded-2xl border border-border bg-card p-4 shadow-sm">
				<button
					type="button"
					onClick={() => refetch()}
					className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
					Actualiser
				</button>
			</div>

			{isLoading && <LoadingState label="Chargement des états de sync…" />}
			{!isLoading && (!states || states.length === 0) && (
				<EmptyState
					icon={RefreshCw}
					title="Aucun état de synchronisation"
					hint="Aucun provider synchronisé."
				/>
			)}
			{!isLoading && states && states.length > 0 && (
				<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
							<tr>
								<th className="px-4 py-3 font-medium">Provider</th>
								<th className="px-4 py-3 font-medium">Statut</th>
								<th className="px-4 py-3 font-medium">Dernière sync</th>
								<th className="px-4 py-3 font-medium">Curseur</th>
								<th className="px-4 py-3 font-medium">Mis à jour</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{states.map((s: NetworkSyncState) => (
								<tr key={s.id} className="hover:bg-accent/40">
									<td className="px-4 py-3 font-medium text-foreground">
										{s.provider}
									</td>
									<td className="px-4 py-3">
										<span className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
											{s.status}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{formatDateTime(s.lastSyncAt)}
									</td>
									<td className="px-4 py-3 font-mono text-xs text-muted-foreground">
										{s.cursor ?? "—"}
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{formatDateTime(s.updatedAt)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
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
	readonly icon: typeof Network;
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
