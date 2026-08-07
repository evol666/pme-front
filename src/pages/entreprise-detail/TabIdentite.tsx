import { FileText, MapPin, TrendingUp, Users } from "lucide-react";
import { AxeRow, IdentiteCard } from "./identite";

// Onglet Identité : fiche INSEE, axes de scoring et synthèse.

export function TabIdentite({
	enriched,
}: {
	readonly enriched: import("@/api/entreprises").EntrepriseEnrichie;
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
						{identite.dirigeants.map((d) => (
							<div
								key={`${d.prenoms ?? ""}-${d.nom ?? ""}-${d.qualite ?? ""}`}
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
					{bodacc.evenements.slice(0, 5).map((ev) => (
						<div
							key={`${ev.date}-${ev.type}`}
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


// ---------------------------------------------------------------------------
// Sous-composants pour le Diagnostic Consultant (Lot C)
// ---------------------------------------------------------------------------
