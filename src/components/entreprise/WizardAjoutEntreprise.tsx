import {
	ArrowLeft,
	ArrowRight,
	Building2,
	Check,
	CheckCircle2,
	Loader2,
	MapPin,
	Search,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	type EntrepriseSearchResult,
	useEntreprise,
	useEntrepriseSearch,
} from "@/api/entreprises";
import {
	type AddEntrepriseInput,
	RELATION_TYPES,
	type RelationType,
	useAddEntreprise,
} from "@/api/portefeuille";
import { libelleTrancheEffectif } from "@/lib/trancheEffectif";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Wizard d'ajout d'entreprise — 3 étapes
// ---------------------------------------------------------------------------

interface WizardProps {
	readonly onClose: () => void;
	readonly onSuccess: (siren: string) => void;
}

// Libellé de l'étape courante — table de correspondance plutôt que ternaires
// imbriquées.
const WIZARD_STEP_LABEL: Record<number, string> = {
	1: "Recherche",
	2: "Confirmation",
	3: "Relation",
};

type Step = 1 | 2 | 3;

export function WizardAjoutEntreprise({ onClose, onSuccess }: WizardProps) {
	const [step, setStep] = useState<Step>(1);
	const [selected, setSelected] = useState<EntrepriseSearchResult | null>(null);
	const [kind, setKind] = useState<RelationType>("prospect");
	const [notes, setNotes] = useState("");

	const addMutation = useAddEntreprise();

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	// Enrichissement au step 2
	const { data: enriched, isLoading: enrichLoading } = useEntreprise(
		step >= 2 ? selected?.siren : null,
	);

	async function handleConfirm() {
		if (!selected) return;

		const input: AddEntrepriseInput = {
			siren: selected.siren,
			label: selected.nomAffichage || selected.raisonSociale,
			kind,
			notes: notes.trim() || undefined,
			codeNaf: selected.codeNaf,
			libelleNaf: enriched?.identite?.libelle_naf ?? null,
			ville: enriched?.identite?.ville ?? null,
			score: enriched?.scoring?.score_global ?? null,
			severity: enriched?.scoring?.severity ?? null,
			statut: enriched?.identite?.statut ?? null,
			effectifTranche: enriched?.identite?.effectif_tranche ?? null,
		};

		await addMutation.mutateAsync(input);
		onSuccess(selected.siren);
	}

	return (
		<div
			aria-label="Fermer l’assistant d’ajout d’entreprise"
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
							<Building2 className="w-4 h-4" />
						</div>
						<div>
							<h2 className="text-sm font-bold text-foreground">
								Ajouter une entreprise
							</h2>
							<p className="text-xs text-muted-foreground">
								Étape {step} sur 3 —{" "}
								{WIZARD_STEP_LABEL[step] ?? ""}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Progress bar */}
				<div className="h-0.5 bg-muted flex-shrink-0">
					<div
						className="h-full bg-primary transition-all duration-300"
						style={{ width: `${(step / 3) * 100}%` }}
					/>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-6 py-5">
					{step === 1 && (
						<Step1Search
							onSelect={(r) => {
								setSelected(r);
								setStep(2);
							}}
						/>
					)}
					{step === 2 && selected && (
						<Step2Confirm
							result={selected}
							enriched={enriched}
							isLoading={enrichLoading}
						/>
					)}
					{step === 3 && selected && (
						<Step3Relation
							kind={kind}
							setKind={setKind}
							notes={notes}
							setNotes={setNotes}
						/>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0 bg-muted/20">
					{step > 1 ? (
						<button
							onClick={() => setStep((s) => (s - 1) as Step)}
							className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							<ArrowLeft className="w-4 h-4" /> Précédent
						</button>
					) : (
						<div />
					)}

					{step < 3 ? (
						<button
							onClick={() => setStep((s) => (s + 1) as Step)}
							disabled={step === 1 ? !selected : false}
							className={cn(
								"flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
								selected || step > 1
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "bg-muted text-muted-foreground cursor-not-allowed",
							)}
						>
							Suivant <ArrowRight className="w-4 h-4" />
						</button>
					) : (
						<button
							onClick={handleConfirm}
							disabled={addMutation.isPending}
							className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
						>
							{addMutation.isPending ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin" /> Ajout en cours…
								</>
							) : (
								<>
									<Check className="w-4 h-4" /> Ajouter au portefeuille
								</>
							)}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Étape 1 — Recherche SIREN / nom
// ---------------------------------------------------------------------------

function Step1Search({
	onSelect,
}: {
	readonly onSelect: (r: EntrepriseSearchResult) => void;
}) {
	const [query, setQuery] = useState("");
	const [debounced, setDebounced] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	useEffect(() => {
		const t = setTimeout(() => setDebounced(query), 300);
		return () => clearTimeout(t);
	}, [query]);

	const { data, isFetching } = useEntrepriseSearch(debounced, 0, 12);
	const results = data?.results ?? [];

	return (
		<div className="space-y-4">
			<div>
				<label
					htmlFor="wizard-entreprise-search"
					className="block text-sm font-semibold text-foreground mb-2"
				>
					SIREN ou nom de l'entreprise
				</label>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
					<input
						ref={inputRef}
						id="wizard-entreprise-search"
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="414056309 ou Athanor…"
						autoComplete="off"
						className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
					/>
					{isFetching && (
						<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
					)}
				</div>
				<p className="mt-1.5 text-xs text-muted-foreground">
					Minimum 2 caractères
				</p>
			</div>

			{results.length > 0 && (
				<div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
					{results.map((r) => (
						<button
							key={r.siren}
							onClick={() => onSelect(r)}
							className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
						>
							<span
								className={cn(
									"mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center",
									r.etat === "A"
										? "bg-emerald-500/10 text-emerald-600"
										: "bg-muted text-muted-foreground",
								)}
							>
								<Building2 className="w-3.5 h-3.5" />
							</span>
							<span className="flex-1 min-w-0">
								<span className="block text-sm font-semibold text-foreground truncate">
									{r.nomAffichage}
								</span>
								<span className="block text-xs text-muted-foreground mt-0.5">
									{r.siren}
									{r.codeNaf && <> · {r.codeNaf}</>}
									{r.etat !== "A" && (
										<span className="ml-2 text-amber-500">cessée</span>
									)}
								</span>
							</span>
							<ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
						</button>
					))}
					{data && data.total > results.length && (
						<div className="px-4 py-2 bg-muted/30">
							<p className="text-xs text-muted-foreground">
								{data.total.toLocaleString("fr-FR")} résultats — affinez pour en
								voir plus
							</p>
						</div>
					)}
				</div>
			)}

			{debounced.length >= 2 && !isFetching && results.length === 0 && (
				<div className="text-center py-8 text-muted-foreground">
					<Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
					<p className="text-sm">Aucune entreprise trouvée</p>
					<p className="text-xs mt-1">
						Vérifiez l'orthographe ou saisissez le SIREN
					</p>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Étape 2 — Confirmation fiche enrichie
// ---------------------------------------------------------------------------

function Step2Confirm({
	result,
	enriched,
	isLoading,
}: {
	readonly result: EntrepriseSearchResult;
	readonly enriched:
		| import("@/api/entreprises").EntrepriseEnrichie
		| null
		| undefined;
	readonly isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
				<Loader2 className="w-7 h-7 animate-spin text-primary" />
				<p className="text-sm">Enrichissement en cours…</p>
				<p className="text-xs">Recherche d'Entreprises · BODACC · Géocodage</p>
			</div>
		);
	}

	const id = enriched?.identite;
	const score = enriched?.scoring?.score_global;
	const severity = enriched?.scoring?.severity;
	let severityClass = "bg-red-500/10 text-red-500";
	if (severity === "faible") severityClass = "bg-emerald-500/10 text-emerald-600";
	else if (severity === "modéré") severityClass = "bg-amber-500/10 text-amber-500";

	return (
		<div className="space-y-5">
			{/* En-tête entreprise */}
			<div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
				<div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
					<Building2 className="w-5 h-5" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="text-base font-bold text-foreground">
							{id?.raison_sociale ?? result.nomAffichage}
						</h3>
						{id?.statut && (
							<span
								className={cn(
									"text-xs px-2 py-0.5 rounded-full font-bold",
									id.statut === "actif"
										? "bg-emerald-500/10 text-emerald-600"
										: "bg-amber-500/10 text-amber-600",
								)}
							>
								{id.statut === "actif" ? "Actif" : "Cessé"}
							</span>
						)}
					</div>
					<p className="text-xs text-muted-foreground mt-1 font-mono">
						{result.siren}
					</p>
					{id?.code_naf && (
						<p className="text-xs text-muted-foreground mt-0.5">
							{id.code_naf} · {id.libelle_naf}
						</p>
					)}
				</div>
				{score != null && (
					<div
						className={cn(
							"flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center",
							severityClass,
						)}
					>
						<span className="text-xl font-extrabold">{score}</span>
						<span className="text-[9px] font-bold text-muted-foreground">
							/100
						</span>
					</div>
				)}
			</div>

			{/* Points clés */}
			{enriched && (
				<div className="grid grid-cols-2 gap-3">
					{[
						{ label: "Ville", value: id?.ville },
						{
							label: "Ancienneté",
							value:
								enriched.synthese?.points_cles?.anciennete_ans == null
									? null
									: `${enriched.synthese.points_cles.anciennete_ans} ans`,
						},
						{
							label: "Effectif",
							value: libelleTrancheEffectif(id?.effectif_tranche),
						},
						{ label: "Catégorie INSEE", value: id?.categorie },
						{ label: "Risque sectoriel", value: id?.risque_sectoriel },
						{ label: "Conv. collective", value: id?.convention_collective },
						{
							label: "Signaux BODACC risque",
							value:
								enriched.synthese?.points_cles?.signaux_bodacc_risque == null
									? null
									: String(enriched.synthese.points_cles.signaux_bodacc_risque),
						},
						{
							label: "Signaux BODACC croissance",
							value:
								enriched.synthese?.points_cles?.signaux_bodacc_croissance ==
								null
									? null
									: String(
											enriched.synthese.points_cles.signaux_bodacc_croissance,
										),
						},
					]
						.filter((r) => r.value)
						.map((r) => (
							<div
								key={r.label}
								className="flex flex-col gap-0.5 px-3 py-2 bg-muted/20 rounded-lg"
							>
								<span className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold">
									{r.label}
								</span>
								<span className="text-xs font-semibold text-foreground truncate">
									{r.value}
								</span>
							</div>
						))}
				</div>
			)}

			{id?.adresse && (
				<div className="flex items-start gap-2 text-xs text-muted-foreground">
					<MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
					<span>
						{[id.adresse, id.code_postal, id.ville].filter(Boolean).join(", ")}
					</span>
				</div>
			)}

			<div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
				<CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
				<p className="text-xs text-muted-foreground">
					Ces données seront mises en cache. Cliquez <strong>Suivant</strong>{" "}
					pour définir la relation avec cette entreprise.
				</p>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Étape 3 — Type de relation + notes
// ---------------------------------------------------------------------------

function Step3Relation({
	kind,
	setKind,
	notes,
	setNotes,
}: {
	readonly kind: RelationType;
	readonly setKind: (k: RelationType) => void;
	readonly notes: string;
	readonly setNotes: (n: string) => void;
}) {
	const COLOR_MAP: Record<string, string> = {
		emerald: "border-emerald-500 bg-emerald-500/10 text-emerald-700",
		blue: "border-blue-500 bg-blue-500/10 text-blue-700",
		violet: "border-violet-500 bg-violet-500/10 text-violet-700",
		amber: "border-amber-500 bg-amber-500/10 text-amber-700",
		orange: "border-orange-500 bg-orange-500/10 text-orange-700",
	};

	return (
		<div className="space-y-6">
			<div>
				<span className="block text-sm font-semibold text-foreground mb-3">
					Type de relation
				</span>
				<div
					role="group"
					aria-label="Type de relation"
					className="grid grid-cols-2 sm:grid-cols-3 gap-2"
				>
					{RELATION_TYPES.map((r) => (
						<button
							key={r.value}
							onClick={() => setKind(r.value)}
							className={cn(
								"px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all text-left",
								kind === r.value
									? COLOR_MAP[r.color]
									: "border-border bg-muted/20 text-muted-foreground hover:bg-accent hover:text-foreground",
							)}
						>
							{r.label}
							{kind === r.value && (
								<Check className="w-3.5 h-3.5 inline ml-1.5" />
							)}
						</button>
					))}
				</div>
			</div>

			<div>
				<label className="block text-sm font-semibold text-foreground mb-2">
					Notes internes{" "}
					<span className="font-normal text-muted-foreground">(optionnel)</span>
				</label>
				<textarea
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					rows={4}
					placeholder="Premier contact lors du salon X… Intérêt pour notre offre Y…"
					className="w-full rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
				/>
			</div>
		</div>
	);
}
