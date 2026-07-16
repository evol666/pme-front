import {
	BarChart3,
	Loader2,
	RefreshCw,
	Search,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";

import {
	type AnalyticsEvent,
	parseAdminJsonObject,
	useAnalyticsEvents,
} from "@/api/admin";
import { cn } from "@/lib/utils";

// Analytics (LOT event-store). Version Spring Boot.
// Liste /api/analytics-events (paginé) avec filtres eventName.contains + category.equals.
// Tri occurredAt,desc. Propriétés @Lob parsées côté client.

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

export default function AnalyticsPage() {
	const [search, setSearch] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");
	const [category, setCategory] = useState("");

	const { data, isLoading, isFetching, refetch } = useAnalyticsEvents(
		appliedSearch || undefined,
		category || undefined,
	);
	const events = data?.content ?? [];

	const categories = Array.from(new Set(events.map((e) => e.category))).sort(
		(a, b) => a.localeCompare(b),
	);

	const submitSearch = (e: React.SubmitEvent) => {
		e.preventDefault();
		setAppliedSearch(search.trim());
	};

	return (
		<div className="space-y-8">
			<header className="space-y-3">
				<p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
					<TrendingUp className="h-4 w-4" />
					Analytics
				</p>
				<h1 className="text-3xl font-bold tracking-tight text-foreground">
					Événements analytics
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Journal des événements instrumentés de la plateforme (event-store).
					Filtrez par nom d’événement ou catégorie.
				</p>
			</header>

			<div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
				<form
					onSubmit={submitSearch}
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
								placeholder="Nom d’événement…"
								className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</label>
					<label className="space-y-1.5">
						<span className="text-sm font-medium text-foreground">
							Catégorie
						</span>
						<input
							type="text"
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							placeholder="ex. analysis, ai…"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
						/>
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
						Actualiser
					</button>
				</form>

				{categories.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
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

			{isLoading && <LoadingState />}
			{!isLoading && events.length === 0 && <EmptyState />}
			{!isLoading && events.length > 0 && (
				<div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
					<table className="w-full text-sm">
						<thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
							<tr>
								<th className="px-4 py-3">Événement</th>
								<th className="px-4 py-3">Catégorie</th>
								<th className="px-4 py-3">Source</th>
								<th className="px-4 py-3 text-right">Valeur</th>
								<th className="px-4 py-3 text-right">Durée</th>
								<th className="px-4 py-3">Date</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{events.map((e) => (
								<EventRow key={e.id} event={e} />
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function EventRow({ event }: { readonly event: AnalyticsEvent }) {
	const [expanded, setExpanded] = useState(false);
	const props = parseAdminJsonObject(event.properties);

	return (
		<>
			<tr
				className="cursor-pointer hover:bg-accent/40"
				onClick={() => setExpanded((v) => !v)}
			>
				<td className="px-4 py-3 font-medium text-foreground">
					{event.eventName}
				</td>
				<td className="px-4 py-3">
					<span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
						{event.category}
					</span>
				</td>
				<td className="px-4 py-3 text-xs text-muted-foreground">
					{event.source ?? "—"}
				</td>
				<td className="px-4 py-3 text-right tabular-nums text-foreground">
					{event.valueNum?.toLocaleString("fr-FR") ?? "—"}
				</td>
				<td className="px-4 py-3 text-right tabular-nums text-foreground">
					{event.durationMs == null ? "—" : `${event.durationMs} ms`}
				</td>
				<td className="px-4 py-3 text-xs text-muted-foreground">
					{formatDateTime(event.occurredAt)}
				</td>
			</tr>
			{expanded && (
				<tr className="bg-background">
					<td colSpan={6} className="px-4 py-3">
						<dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
							<Detail
								label="Sujet"
								value={
									[event.subjectKind, event.subjectId]
										.filter(Boolean)
										.join(" · ") || "—"
								}
							/>
							<Detail label="Session" value={event.sessionId ?? "—"} />
							<Detail label="Requête" value={event.requestId ?? "—"} />
						</dl>
						{props && (
							<pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
								{JSON.stringify(props, null, 2)}
							</pre>
						)}
					</td>
				</tr>
			)}
		</>
	);
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
	return (
		<div>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="mt-0.5 break-all font-mono text-foreground">{value}</dd>
		</div>
	);
}

function LoadingState() {
	return (
		<div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
			<Loader2 className="mr-2 h-5 w-5 animate-spin" />
			Chargement des événements…
		</div>
	);
}

function EmptyState() {
	return (
		<div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
			<BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
			<p className="text-sm font-medium text-foreground">Aucun événement</p>
			<p className="mt-1 text-sm text-muted-foreground">
				Aucun événement ne correspond aux filtres, ou l’event-store est vide.
			</p>
		</div>
	);
}
