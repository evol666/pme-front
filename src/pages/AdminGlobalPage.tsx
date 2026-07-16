import {
	Brain,
	Building2,
	Eye,
	Loader2,
	Palette,
	RefreshCw,
	Search,
	Settings,
	Sparkles,
	Trash2,
	Users,
} from "lucide-react";
import { useState } from "react";

import {
	parseAdminJsonObject,
	type Tenant,
	type TenantBranding,
	type TenantMemory,
	type TenantPlan,
	type TenantPlanQuota,
	type TenantProfile,
	type TenantSettings,
	type TenantStatus,
	useDeleteTenant,
	useDeleteTenantMemory,
	usePatchTenant,
	usePatchTenantPlan,
	useTenantBrandings,
	useTenantMemories,
	useTenantPlans,
	useTenantProfiles,
	useTenantSettings,
	useTenants,
} from "@/api/admin";
import { cn } from "@/lib/utils";

// Admin-global (LOT multi-tenant). Version Spring Boot.
// 6 onglets : Tenants (/api/tenants, CRUD) · Settings · Profile · Plan (toggle isActive) ·
// Branding · Memory (delete). Les 5 derniers filtrent par tenantId.equals.

type TabKey =
	| "tenants"
	| "settings"
	| "profile"
	| "plan"
	| "branding"
	| "memory";

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
	{ key: "tenants", label: "Tenants", icon: Users },
	{ key: "settings", label: "Settings", icon: Settings },
	{ key: "profile", label: "Profile", icon: Eye },
	{ key: "plan", label: "Plan", icon: Sparkles },
	{ key: "branding", label: "Branding", icon: Palette },
	{ key: "memory", label: "Memory", icon: Brain },
];

const PLAN_TONE: Record<TenantPlan, string> = {
	FREE: "bg-muted text-muted-foreground",
	STARTER: "bg-sky-500/10 text-sky-600",
	PRO: "bg-emerald-500/10 text-emerald-600",
	ENTERPRISE: "bg-primary/10 text-primary",
};

const STATUS_TONE: Record<TenantStatus, string> = {
	ACTIVE: "bg-emerald-500/10 text-emerald-600",
	SUSPENDED: "bg-amber-500/10 text-amber-600",
	DELETED: "bg-red-500/10 text-red-600",
};

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

export default function AdminGlobalPage() {
	const [tab, setTab] = useState<TabKey>("tenants");

	return (
		<div className="space-y-8">
			<header className="space-y-3">
				<p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
					<Building2 className="h-4 w-4" />
					Administration globale
				</p>
				<h1 className="text-3xl font-bold tracking-tight text-foreground">
					Tenants & configuration
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Gestion multi-tenant : organisations, préférences, profil, plan,
					branding et mémoire. Réservé aux administrateurs plateforme.
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

			{tab === "tenants" && <TenantsTab />}
			{tab === "settings" && <SettingsTab />}
			{tab === "profile" && <ProfileTab />}
			{tab === "plan" && <PlanTab />}
			{tab === "branding" && <BrandingTab />}
			{tab === "memory" && <MemoryTab />}
		</div>
	);
}

// --- Tenants ---

function TenantsTab() {
	const [search, setSearch] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");
	const [error, setError] = useState<string | null>(null);

	const { data, isLoading, isFetching, refetch } = useTenants(
		undefined,
		appliedSearch || undefined,
	);
	const patchMutation = usePatchTenant();
	const deleteMutation = useDeleteTenant();

	const submitSearch = (e: React.SubmitEvent) => {
		e.preventDefault();
		setAppliedSearch(search.trim());
	};

	const cyclePlan = async (t: Tenant) => {
		const order: TenantPlan[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
		const next = order[(order.indexOf(t.plan) + 1) % order.length];
		setError(null);
		try {
			await patchMutation.mutateAsync({ id: t.id, plan: next });
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	const toggleStatus = async (t: Tenant) => {
		const next: TenantStatus = t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
		setError(null);
		try {
			await patchMutation.mutateAsync({ id: t.id, status: next });
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	const handleDelete = async (t: Tenant) => {
		if (
			!globalThis.confirm(`Supprimer le tenant « ${t.name} » ? Action définitive.`)
		)
			return;
		setError(null);
		try {
			await deleteMutation.mutateAsync(t.id);
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
				<form
					onSubmit={submitSearch}
					className="flex flex-col gap-3 sm:flex-row"
				>
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Nom du tenant…"
							className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
					<button
						type="submit"
						className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						Filtrer
					</button>
					<button
						type="button"
						onClick={() => refetch()}
						className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
					>
						<RefreshCw
							className={cn("h-4 w-4", isFetching && "animate-spin")}
						/>
						Actualiser
					</button>
				</form>
			</div>

			{error && <ErrorBanner message={error} />}

			{isLoading && <LoadingState label="Chargement des tenants…" />}
			{!isLoading && (!data || data.length === 0) && (
				<EmptyState
					icon={Users}
					title="Aucun tenant"
					hint="Aucune organisation ne correspond à la recherche."
				/>
			)}
			{!isLoading && data && data.length > 0 && (
				<div className="grid gap-3 md:grid-cols-2">
					{data.map((t) => (
						<TenantCard
							key={t.id}
							tenant={t}
							busy={
								(patchMutation.isPending &&
									patchMutation.variables?.id === t.id) ||
								(deleteMutation.isPending && deleteMutation.variables === t.id)
							}
							onCyclePlan={() => cyclePlan(t)}
							onToggleStatus={() => toggleStatus(t)}
							onDelete={() => handleDelete(t)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function TenantCard({
	tenant,
	busy,
	onCyclePlan,
	onToggleStatus,
	onDelete,
}: {
	readonly tenant: Tenant;
	readonly busy: boolean;
	readonly onCyclePlan: () => void;
	readonly onToggleStatus: () => void;
	readonly onDelete: () => void;
}) {
	return (
		<article className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<h3 className="text-base font-semibold text-foreground">
						{tenant.name}
					</h3>
					<p className="font-mono text-xs text-muted-foreground">
						{tenant.slug}
					</p>
				</div>
				<button
					type="button"
					onClick={onDelete}
					disabled={busy}
					className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
				>
					{busy ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Trash2 className="h-3.5 w-3.5" />
					)}
				</button>
			</header>

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={onCyclePlan}
					disabled={busy}
					className={cn(
						"rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-60",
						PLAN_TONE[tenant.plan],
					)}
				>
					<Sparkles className="mr-1 inline h-3 w-3" />
					{tenant.plan}
				</button>
				<button
					type="button"
					onClick={onToggleStatus}
					disabled={busy}
					className={cn(
						"rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-60",
						STATUS_TONE[tenant.status],
					)}
				>
					{tenant.status}
				</button>
			</div>

			<dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
				<Field label="ID" value={String(tenant.id)} />
				<Field label="Créé" value={formatDateTime(tenant.createdAt)} />
			</dl>
		</article>
	);
}

// --- Settings ---

function SettingsTab() {
	const { data, isLoading, isFetching, refetch } = useTenantSettings();
	if (isLoading) return <LoadingState label="Chargement des settings…" />;
	if (!data || data.length === 0)
		return (
			<EmptyState
				icon={Settings}
				title="Aucun paramètre"
				hint="Aucun réglage tenant enregistré."
			/>
		);
	return (
		<div className="space-y-4">
			<RefetchButton isFetching={isFetching} onClick={() => refetch()} />
			<div className="grid gap-3 md:grid-cols-2">
				{data.map((s) => (
					<SettingsCard key={s.id} settings={s} />
				))}
			</div>
		</div>
	);
}

function SettingsCard({ settings }: { readonly settings: TenantSettings }) {
	const features = parseAdminJsonObject(settings.enabledFeatures);
	return (
		<article className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
			<h3 className="text-sm font-semibold text-foreground">
				Tenant #{settings.tenant.id}
				{settings.tenant.name && (
					<span className="ml-2 text-muted-foreground">
						· {settings.tenant.name}
					</span>
				)}
			</h3>
			<dl className="grid grid-cols-2 gap-2 text-xs">
				<Field
					label="Couleur primaire"
					value={settings.customPrimaryColor ?? "—"}
				/>
				<Field
					label="Couleur secondaire"
					value={settings.customSecondaryColor ?? "—"}
				/>
				<Field label="Domaine" value={settings.customDomain ?? "—"} />
				<Field label="Template PDF" value={settings.pdfTemplate ?? "—"} />
				<Field label="Logo" value={settings.customLogoUrl ? "Défini" : "—"} />
				<Field
					label="Personnalité IA"
					value={settings.aiPersonality ? "Définie" : "—"}
				/>
			</dl>
			{features && (
				<pre className="overflow-x-auto rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground">
					{JSON.stringify(features, null, 2)}
				</pre>
			)}
		</article>
	);
}

// --- Profile ---

function ProfileTab() {
	const { data, isLoading, isFetching, refetch } = useTenantProfiles();
	if (isLoading) return <LoadingState label="Chargement des profils…" />;
	if (!data || data.length === 0)
		return (
			<EmptyState
				icon={Eye}
				title="Aucun profil"
				hint="Aucun profil tenant enregistré."
			/>
		);
	return (
		<div className="space-y-4">
			<RefetchButton isFetching={isFetching} onClick={() => refetch()} />
			<div className="grid gap-3 md:grid-cols-2">
				{data.map((p) => (
					<ProfileCard key={p.id} profile={p} />
				))}
			</div>
		</div>
	);
}

function ProfileCard({ profile }: { readonly profile: TenantProfile }) {
	const attrs = parseAdminJsonObject(profile.attributes);
	return (
		<article className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
			<h3 className="text-sm font-semibold text-foreground">
				Tenant #{profile.tenant.id}
				{profile.tenant.name && (
					<span className="ml-2 text-muted-foreground">
						· {profile.tenant.name}
					</span>
				)}
			</h3>
			<dl className="grid grid-cols-2 gap-2 text-xs">
				<Field label="Secteur" value={profile.sector ?? "—"} />
				<Field label="Maturité" value={profile.maturityLevel ?? "—"} />
				<div className="col-span-2">
					<dt className="text-muted-foreground">Objectif principal</dt>
					<dd className="mt-0.5 text-foreground">
						{profile.primaryGoal ?? "—"}
					</dd>
				</div>
			</dl>
			{attrs && (
				<pre className="overflow-x-auto rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground">
					{JSON.stringify(attrs, null, 2)}
				</pre>
			)}
		</article>
	);
}

// --- Plan (quota) ---

function PlanTab() {
	const { data, isLoading, isFetching, refetch } = useTenantPlans();
	const patchMutation = usePatchTenantPlan();
	const [error, setError] = useState<string | null>(null);

	const toggle = async (p: TenantPlanQuota) => {
		setError(null);
		try {
			await patchMutation.mutateAsync({ id: p.id, isActive: !p.isActive });
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	if (isLoading) return <LoadingState label="Chargement des plans…" />;
	if (!data || data.length === 0)
		return (
			<EmptyState
				icon={Sparkles}
				title="Aucun plan"
				hint="Aucun quota plan enregistré."
			/>
		);

	return (
		<div className="space-y-4">
			<RefetchButton isFetching={isFetching} onClick={() => refetch()} />
			{error && <ErrorBanner message={error} />}
			<div className="grid gap-3 md:grid-cols-2">
				{data.map((p) => (
					<PlanCard
						key={p.id}
						plan={p}
						busy={
							patchMutation.isPending && patchMutation.variables?.id === p.id
						}
						onToggle={() => toggle(p)}
					/>
				))}
			</div>
		</div>
	);
}

function PlanCard({
	plan,
	busy,
	onToggle,
}: {
	readonly plan: TenantPlanQuota;
	readonly busy: boolean;
	readonly onToggle: () => void;
}) {
	return (
		<article className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
			<header className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-foreground">
						{plan.planName}
					</h3>
					<p className="text-xs text-muted-foreground">
						Tenant #{plan.tenant.id}
						{plan.tenant.name && ` · ${plan.tenant.name}`}
					</p>
				</div>
				<button
					type="button"
					onClick={onToggle}
					disabled={busy}
					className={cn(
						"rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-60",
						plan.isActive
							? "bg-emerald-500/10 text-emerald-600"
							: "bg-muted text-muted-foreground",
					)}
				>
					{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
					{!busy && (plan.isActive ? "Actif" : "Inactif")}
				</button>
			</header>
			<dl className="grid grid-cols-2 gap-2 text-xs">
				<Field
					label="Limite tokens/mois"
					value={plan.monthlyTokenLimit?.toLocaleString("fr-FR") ?? "—"}
				/>
				<Field
					label="Limite requêtes/mois"
					value={plan.monthlyRequestLimit?.toLocaleString("fr-FR") ?? "—"}
				/>
			</dl>
		</article>
	);
}

// --- Branding ---

function BrandingTab() {
	const { data, isLoading, isFetching, refetch } = useTenantBrandings();
	if (isLoading) return <LoadingState label="Chargement du branding…" />;
	if (!data || data.length === 0)
		return (
			<EmptyState
				icon={Palette}
				title="Aucun branding"
				hint="Aucun branding tenant enregistré."
			/>
		);
	return (
		<div className="space-y-4">
			<RefetchButton isFetching={isFetching} onClick={() => refetch()} />
			<div className="grid gap-3 md:grid-cols-2">
				{data.map((b) => (
					<BrandingCard key={b.id} branding={b} />
				))}
			</div>
		</div>
	);
}

function BrandingCard({ branding }: { readonly branding: TenantBranding }) {
	return (
		<article className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
			<h3 className="text-sm font-semibold text-foreground">
				{branding.displayName ?? `Tenant #${branding.tenant.id}`}
			</h3>
			<div className="flex flex-wrap gap-2">
				{branding.primaryColor && (
					<span
						className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
						style={{ color: branding.primaryColor }}
					>
						<span
							className="h-2 w-2 rounded-full"
							style={{ backgroundColor: branding.primaryColor }}
						/>
						{"Primaire"}
					</span>
				)}
				{branding.accentColor && (
					<span
						className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
						style={{ color: branding.accentColor }}
					>
						<span
							className="h-2 w-2 rounded-full"
							style={{ backgroundColor: branding.accentColor }}
						/>
						{"Accent"}
					</span>
				)}
				{branding.theme && (
					<span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
						{branding.theme}
					</span>
				)}
			</div>
			<dl className="grid grid-cols-2 gap-2 text-xs">
				<Field label="Logo" value={branding.logoUrl ? "Défini" : "—"} />
				<Field label="Mis à jour" value={formatDateTime(branding.updatedAt)} />
			</dl>
		</article>
	);
}

// --- Memory ---

function MemoryTab() {
	const [category, setCategory] = useState("");
	const { data, isLoading, isFetching, refetch } = useTenantMemories(
		category || undefined,
	);
	const deleteMutation = useDeleteTenantMemory();
	const [error, setError] = useState<string | null>(null);

	const handleDelete = async (m: TenantMemory) => {
		if (!globalThis.confirm(`Supprimer la mémoire « ${m.key} » ?`)) return;
		setError(null);
		try {
			await deleteMutation.mutateAsync(m.id);
		} catch (err) {
			setError(extractBackendError(err));
		}
	};

	const categories = Array.from(
		new Set((data ?? []).map((m) => m.category)),
	).sort((a, b) => a.localeCompare(b));

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<label className="flex-1 space-y-1.5">
						<span className="text-sm font-medium text-foreground">
							Catégorie
						</span>
						<input
							type="text"
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							placeholder="ex. preference, fact…"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</label>
					<button
						type="button"
						onClick={() => refetch()}
						className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
					>
						<RefreshCw
							className={cn("h-4 w-4", isFetching && "animate-spin")}
						/>
						Actualiser
					</button>
				</div>
				{categories.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{categories.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setCategory(c)}
								className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
							>
								{c}
							</button>
						))}
					</div>
				)}
			</div>

			{error && <ErrorBanner message={error} />}

			{isLoading && <LoadingState label="Chargement de la mémoire…" />}
			{!isLoading && (!data || data.length === 0) && (
				<EmptyState
					icon={Brain}
					title="Aucune mémoire"
					hint="Aucune entrée mémoire tenant enregistrée."
				/>
			)}
			{!isLoading && data && data.length > 0 && (
				<div className="space-y-3">
					{data.map((m) => (
						<MemoryCard
							key={m.id}
							memory={m}
							busy={
								deleteMutation.isPending && deleteMutation.variables === m.id
							}
							onDelete={() => handleDelete(m)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function MemoryCard({
	memory,
	busy,
	onDelete,
}: {
	readonly memory: TenantMemory;
	readonly busy: boolean;
	readonly onDelete: () => void;
}) {
	return (
		<article className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
							{memory.category}
						</span>
						<span className="font-mono text-sm font-medium text-foreground">
							{memory.key}
						</span>
						<span className="text-xs text-muted-foreground">
							· {memory.source}
						</span>
					</div>
					{memory.value && (
						<p className="whitespace-pre-wrap break-all text-sm text-muted-foreground line-clamp-4">
							{memory.value}
						</p>
					)}
				</div>
				<button
					type="button"
					onClick={onDelete}
					disabled={busy}
					className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
				>
					{busy ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Trash2 className="h-3.5 w-3.5" />
					)}
				</button>
			</header>
			<dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
				<Field
					label="Confiance"
					value={`${Math.round((memory.confidenceScore ?? 0) * 100)}%`}
				/>
				<Field label="Hits" value={String(memory.hitCount)} />
				<Field label="Vu" value={formatDateTime(memory.lastSeenAt)} />
			</dl>
		</article>
	);
}

// --- États partagés ---

function RefetchButton({
	isFetching,
	onClick,
}: {
	readonly isFetching: boolean;
	readonly onClick: () => void;
}) {
	return (
		<div className="flex justify-end">
			<button
				type="button"
				onClick={onClick}
				className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
			>
				<RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
				Actualiser
			</button>
		</div>
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
	readonly icon: typeof Building2;
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
