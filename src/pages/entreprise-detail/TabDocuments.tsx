import { FileText } from "lucide-react";
import { useDocuments } from "@/api/documents";
import { EmptyTab, LoadingSpinner } from "./etats";

// Onglet Documents : pièces indexées pour l'entreprise.

export function TabDocuments({ siren }: { readonly siren: string }) {
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
