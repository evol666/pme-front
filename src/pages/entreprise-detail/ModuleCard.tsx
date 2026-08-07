import { Copy, Download, Loader2, Play, X } from "lucide-react";
import { useState } from "react";
import type { ExecuteModuleResponse } from "@/api/modules";
import {
	downloadModuleMarkdown,
	extractModuleError,
} from "./helpers";
import type { CatalogItem } from "./types";

// Carte d'un module ou outil métier, et tiroir affichant le livrable qu'il
// produit une fois exécuté.

export function ModuleCard({
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

export function ModuleLivrableDrawer({
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
