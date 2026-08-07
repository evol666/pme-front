import { AlertTriangle, PiggyBank } from "lucide-react";
import type { ExerciceFinancier, FinancesData } from "@/api/entreprises";
import { fmtEuros } from "./helpers";
import { cn } from "@/lib/utils";

// Onglet Finances : bilans multi-exercices et alerte de procédure collective.

const FINANCE_ROWS: {
	key: keyof ExerciceFinancier;
	label: string;
	section: "cr" | "bilan";
}[] = [
	{ key: "chiffre_affaires",           label: "Chiffre d'affaires",          section: "cr"    },
	{ key: "excedent_brut_exploitation", label: "EBE",                          section: "cr"    },
	{ key: "resultat_exploitation",      label: "Résultat d'exploitation",      section: "cr"    },
	{ key: "resultat_net",               label: "Résultat net",                 section: "cr"    },
	{ key: "total_actif",                label: "Total actif",                  section: "bilan" },
	{ key: "capitaux_propres",           label: "Capitaux propres",             section: "bilan" },
	{ key: "tresorerie",                 label: "Trésorerie",                   section: "bilan" },
	{ key: "creances_clients",           label: "Créances clients",             section: "bilan" },
	{ key: "dettes_fiscales_sociales",   label: "Dettes fiscales & sociales",   section: "bilan" },
];

export function TabFinances({
	finances,
}: {
	readonly finances: FinancesData | null;
}) {
	const proc = finances?.procedure_collective;
	const exercices = (finances?.exercices ?? []).slice(0, 6); // max 6 colonnes

	return (
		<div className="space-y-4">
			{/* Procédure collective */}
			{proc && (
				<div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
					<AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
					<div>
						<p className="text-sm font-bold text-red-700">{proc.libelle}</p>
						<p className="text-xs text-red-600 mt-0.5">
							{proc.tribunal && <span>{proc.tribunal}</span>}
							{proc.tribunal && proc.date && " · "}
							{proc.date && (
								<span>
									{new Date(proc.date).toLocaleDateString("fr-FR", {
										day: "2-digit",
										month: "long",
										year: "numeric",
									})}
								</span>
							)}
						</p>
					</div>
				</div>
			)}

			{/* Tableau des exercices */}
			{exercices.length > 0 ? (
				<div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
					<div className="flex items-center gap-2 px-5 py-4 border-b border-border/50">
						<PiggyBank className="w-4 h-4 text-primary" />
						<h2 className="text-sm font-bold">Données financières</h2>
						{finances?.source && (
							<span className="ml-auto text-xs text-muted-foreground uppercase tracking-wider">
								Source : {finances.source}
							</span>
						)}
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b border-border/40 bg-muted/30">
									<th className="text-left px-5 py-2.5 font-semibold text-muted-foreground w-48">
										EN EUROS
									</th>
									{exercices.map((ex) => (
										<th
											key={ex.annee ?? ex.date_cloture}
											className="text-right px-4 py-2.5 font-bold text-foreground"
										>
											{ex.annee ?? "—"}
											{ex.confidentiel && (
												<span
													className="ml-1 text-muted-foreground font-normal"
													title="Comptes partiellement confidentiels"
												>
													*
												</span>
											)}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30">
								{(["cr", "bilan"] as const).map((section) => (
									<>
										<tr key={`header-${section}`} className="bg-muted/20">
											<td
												colSpan={exercices.length + 1}
												className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
											>
												{section === "cr"
													? "Compte de résultat"
													: "Bilan"}
											</td>
										</tr>
										{FINANCE_ROWS.filter((r) => r.section === section).map(
											(row) => (
												<tr
													key={row.key}
													className="hover:bg-muted/20 transition-colors"
												>
													<td className="px-5 py-2 text-muted-foreground">
														{row.label}
													</td>
													{exercices.map((ex) => {
														const val = ex[row.key] as
															| number
															| null
															| undefined;
														const isNeg =
															typeof val === "number" && val < 0;
														const isPos =
															typeof val === "number" && val > 0;
														const isKey =
															row.key === "resultat_net" ||
															row.key === "chiffre_affaires";
														let valueColorClass = "text-foreground";
														if (isKey && isNeg) valueColorClass = "text-red-600";
														else if (isKey && isPos) valueColorClass = "text-emerald-600";
														return (
															<td
																key={ex.annee}
																className={cn(
																	"px-4 py-2 text-right tabular-nums",
																	isKey && "font-semibold",
																	valueColorClass,
																)}
															>
																{val == null && ex.confidentiel
																	? "<conf.>"
																	: fmtEuros(val)}
															</td>
														);
													})}
												</tr>
											),
										)}
									</>
								))}
							</tbody>
						</table>
					</div>

					{exercices.some((e) => e.confidentiel) && (
						<p className="px-5 py-2.5 text-xs text-muted-foreground border-t border-border/30">
							* Comptes soumis à confidentialité partielle (art. L. 232-25 du
							Code de commerce).
						</p>
					)}
				</div>
			) : (
				<div className="bg-card border border-border/50 rounded-2xl p-8 shadow-sm text-center space-y-3">
					<PiggyBank className="w-8 h-8 text-muted-foreground/40 mx-auto" />
					<p className="text-sm font-semibold text-muted-foreground">
						Données financières non disponibles
					</p>
					<p className="text-xs text-muted-foreground max-w-xs mx-auto">
						Configurez la variable d'environnement{" "}
						<code className="font-mono bg-muted px-1 rounded">INPI_TOKEN</code>{" "}
						pour accéder aux bilans et comptes de résultat déposés au greffe
						(compte gratuit sur{" "}
						<a
							href="https://registre-national-entreprises.inpi.fr/"
							target="_blank"
							rel="noreferrer"
							className="text-primary hover:underline"
						>
							registre-national-entreprises.inpi.fr
						</a>
						{")."}
					</p>
				</div>
			)}
		</div>
	);
}

// Supprimé (doublon de TabAnalyses)

// ---------------------------------------------------------------------------
// Onglet Recommandations
// ---------------------------------------------------------------------------

// Extrait un message d'erreur lisible d'une réponse axios (le backend PME
// renvoie {error: {message}} ; on retombe sur le message générique).




