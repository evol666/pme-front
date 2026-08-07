import { BookOpen } from "lucide-react";
import { useJournalEvents } from "@/api/journal";
import { EmptyTab, LoadingSpinner } from "./etats";

// Onglet Journal : chronologie des événements rattachés au SIREN.

export function TabJournal({ siren }: { readonly siren: string }) {
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
