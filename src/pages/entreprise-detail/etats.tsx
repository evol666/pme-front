import { AlertTriangle, ArrowLeft, Loader2, Plus } from "lucide-react";

// États transverses des onglets de la fiche entreprise : chargement, panneau
// vide et vue d'erreur. Extraits pour être partagés sans dupliquer le balisage.

export function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
			<Loader2 className="w-5 h-5 animate-spin text-primary" />
			<span className="text-sm">Chargement…</span>
		</div>
	);
}

export function EmptyTab({
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

export function ErrorView({
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

