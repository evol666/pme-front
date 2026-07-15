import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  usePortefeuille,
  useRemoveEntreprise,
  useAddEntreprise,
  RELATION_TYPES,
  type RelationType,
  type EntreprisePortefeuille,
} from "@/api/portefeuille";
import { WizardAjoutEntreprise } from "@/components/entreprise/WizardAjoutEntreprise";
import { ImportCsvModal } from "@/components/entreprise/ImportCsvModal";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Couleurs par type de relation
// ---------------------------------------------------------------------------

const KIND_STYLE: Record<string, string> = {
  client:      "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  prospect:    "bg-blue-500/10 text-blue-700 border-blue-200",
  partenaire:  "bg-violet-500/10 text-violet-700 border-violet-200",
  concurrent:  "bg-amber-500/10 text-amber-700 border-amber-200",
  fournisseur: "bg-orange-500/10 text-orange-700 border-orange-200",
};

function scoreSeverityColor(s: string | null) {
  if (s === "faible") return "text-emerald-600";
  if (s === "modéré") return "text-amber-500";
  if (s === "élevé") return "text-red-500";
  return "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function EntreprisesPage() {
  const navigate = useNavigate();
  const [filterKind, setFilterKind] = useState<RelationType | "">("");
  const [search, setSearch] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: entreprises, isLoading, refetch } = usePortefeuille(filterKind || undefined);
  const removeMutation = useRemoveEntreprise();
  const addMutation = useAddEntreprise();
  const [isSeeding, setIsSeeding] = useState(false);

  async function handleSeed() {
    setIsSeeding(true);
    try {
      for (const company of DEMO_COMPANIES) {
        await addMutation.mutateAsync({
          siren: company.siren,
          label: company.label,
          kind: company.kind,
          notes: company.notes,
          codeNaf: company.codeNaf,
          libelleNaf: company.libelleNaf,
          ville: company.ville,
          score: company.score,
          severity: company.severity,
          statut: company.statut,
          effectifTranche: company.effectifTranche,
        });
      }
      await refetch();
    } catch (err) {
      console.error("Échec du seed démo:", err);
    } finally {
      setIsSeeding(false);
    }
  }

  const filtered = (entreprises ?? []).filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.label.toLowerCase().includes(q) ||
      e.siren.includes(q) ||
      (e.ville ?? "").toLowerCase().includes(q)
    );
  });

  const counts = (entreprises ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});

  async function handleDelete(id: number) {
    await removeMutation.mutateAsync(id);
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Portefeuille</p>
          <h1 className="text-2xl font-extrabold text-foreground mt-0.5">Entreprises</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(entreprises ?? []).length} entreprise{(entreprises ?? []).length !== 1 ? "s" : ""} suivie{(entreprises ?? []).length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importer CSV
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Filtres type de relation */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterKind("")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
            filterKind === ""
              ? "bg-foreground text-background border-foreground"
              : "bg-muted/30 text-muted-foreground border-border hover:bg-accent",
          )}
        >
          Tous ({(entreprises ?? []).length})
        </button>
        {RELATION_TYPES.map((r) => (
          <button
            key={r.value}
            onClick={() => setFilterKind(filterKind === r.value ? "" : r.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              filterKind === r.value
                ? KIND_STYLE[r.value]
                : "bg-muted/30 text-muted-foreground border-border hover:bg-accent",
            )}
          >
            {r.label} ({counts[r.value] ?? 0})
          </button>
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer par nom, SIREN ou ville…"
          className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Contenu */}
      {isLoading || isSeeding ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">
            {isSeeding ? "Initialisation du portefeuille de démonstration…" : "Chargement du portefeuille…"}
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasFilter={!!filterKind || !!search}
          onAdd={() => setShowWizard(true)}
          onSeed={handleSeed}
          isSeeding={isSeeding}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <EntrepriseCard
              key={e.id}
              entreprise={e}
              onOpen={() => navigate(`/entreprises/${e.siren}`)}
              onDeleteRequest={() => setDeleteConfirm(e.id)}
            />
          ))}
        </div>
      )}

      {/* Dialog suppression */}
      {deleteConfirm !== null && (
        <ConfirmDelete
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
          isPending={removeMutation.isPending}
        />
      )}

      {/* Import CSV */}
      {showImport && (
        <ImportCsvModal
          onClose={() => setShowImport(false)}
          onSuccess={() => setShowImport(false)}
        />
      )}

      {/* Wizard */}
      {showWizard && (
        <WizardAjoutEntreprise
          onClose={() => setShowWizard(false)}
          onSuccess={(siren) => {
            setShowWizard(false);
            navigate(`/entreprises/${siren}`);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte entreprise
// ---------------------------------------------------------------------------

function EntrepriseCard({
  entreprise: e,
  onOpen,
  onDeleteRequest,
}: {
  readonly entreprise: EntreprisePortefeuille;
  readonly onOpen: () => void;
  readonly onDeleteRequest: () => void;
}) {
  return (
    <div className="group bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:border-primary/30 transition-all flex flex-col gap-3">
      {/* Row 1 : badge type + score */}
      <div className="flex items-center justify-between">
        <span className={cn(
          "px-2.5 py-1 rounded-full text-xs font-bold border",
          KIND_STYLE[e.kind] ?? "bg-muted text-muted-foreground border-border",
        )}>
          {RELATION_TYPES.find(r => r.value === e.kind)?.label ?? e.kind}
        </span>
        {e.score != null && (
          <div className="flex items-center gap-1">
            <TrendingUp className={cn("w-3.5 h-3.5", scoreSeverityColor(e.severity))} />
            <span className={cn("text-sm font-bold", scoreSeverityColor(e.severity))}>
              {e.score}<span className="text-xs font-normal text-muted-foreground">/100</span>
            </span>
          </div>
        )}
      </div>

      {/* Row 2 : nom + SIREN */}
      <div>
        <h3 className="font-bold text-foreground leading-tight line-clamp-2">{e.label}</h3>
        <p className="text-xs font-mono text-muted-foreground mt-0.5">{e.siren}</p>
      </div>

      {/* Row 3 : NAF + ville */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {e.codeNaf && (
          <span className="px-2 py-0.5 bg-muted/40 rounded-md">
            {e.codeNaf}
          </span>
        )}
        {e.ville && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {e.ville}
          </span>
        )}
        {e.statut && e.statut !== "actif" && (
          <span className="text-amber-500 font-medium">Cessée</span>
        )}
      </div>

      {/* Notes */}
      {e.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2 italic border-t border-border/40 pt-2">
          {e.notes}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={onOpen}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/8 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors"
        >
          Ouvrir la fiche <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onDeleteRequest}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Retirer du portefeuille"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  hasFilter,
  onAdd,
  onSeed,
  isSeeding,
}: {
  readonly hasFilter: boolean;
  readonly onAdd: () => void;
  readonly onSeed: () => void;
  readonly isSeeding: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
        <Building2 className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {hasFilter ? "Aucune entreprise ne correspond" : "Portefeuille vide"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {hasFilter
            ? "Modifiez les filtres ou ajoutez une nouvelle entreprise"
            : "Ajoutez vos clients, prospects et partenaires pour commencer"}
        </p>
      </div>
      {!hasFilter && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onAdd}
            disabled={isSeeding}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Ajouter une entreprise
          </button>
          <button
            type="button"
            onClick={onSeed}
            disabled={isSeeding}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border hover:bg-accent rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Charger les entreprises de démonstration
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog confirmation suppression
// ---------------------------------------------------------------------------

function ConfirmDelete({
  onConfirm,
  onCancel,
  isPending,
}: {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
          <Trash2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Retirer du portefeuille ?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            L'entreprise sera supprimée de votre suivi. Les analyses et documents associés ne sont pas affectés.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-60"
          >
            {isPending ? "Suppression…" : "Retirer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Données de démonstration (seed local)
// ---------------------------------------------------------------------------

const DEMO_COMPANIES = [
  { siren: "900111001", label: "Boulangerie du Marché", kind: "client" as const, codeNaf: "10.71C", libelleNaf: "Boulangerie et boulangerie-pâtisserie", ville: "Lyon", score: 65, severity: "faible", statut: "actif", effectifTranche: "3 à 5 salariés", notes: "Boulangerie artisanale de quartier." },
  { siren: "900111002", label: "Le Petit Bistrot", kind: "prospect" as const, codeNaf: "56.10A", libelleNaf: "Restauration traditionnelle", ville: "Paris", score: 64, severity: "modéré", statut: "actif", effectifTranche: "6 à 9 salariés", notes: "Restauration traditionnelle de saison." },
  { siren: "900111003", label: "Cabinet Médical Beauregard", kind: "partenaire" as const, codeNaf: "86.21Z", libelleNaf: "Activité des médecins généralistes", ville: "Bordeaux", score: 70, severity: "faible", statut: "actif", effectifTranche: "3 à 5 salariés", notes: "Cabinet médical de proximité." },
  { siren: "900111004", label: "Atelier d'Architecture Reverbel", kind: "fournisseur" as const, codeNaf: "71.11Z", libelleNaf: "Activités d'architecture", ville: "Nantes", score: 75, severity: "faible", statut: "actif", effectifTranche: "10 à 19 salariés", notes: "Cabinet d'architecture et maîtrise d'œuvre." },
  { siren: "900111005", label: "Maison Lemoine — Coiffure & Barbier", kind: "concurrent" as const, codeNaf: "96.02A", libelleNaf: "Coiffure", ville: "Marseille", score: 58, severity: "modéré", statut: "actif", effectifTranche: "1 à 2 salariés", notes: "Salon coiffeur/barbier." },
  { siren: "900111006", label: "Garage Dupont & Fils", kind: "client" as const, codeNaf: "45.20A", libelleNaf: "Entretien et réparation de véhicules", ville: "Toulouse", score: 62, severity: "modéré", statut: "actif", effectifTranche: "3 à 5 salariés", notes: "Garage mécanique de quartier." },
  { siren: "900111007", label: "Domaine du Coteau", kind: "prospect" as const, codeNaf: "01.21Z", libelleNaf: "Culture de la vigne", ville: "Beaune", score: 80, severity: "faible", statut: "actif", effectifTranche: "6 à 9 salariés", notes: "Viticulteur et vinificateur." },
  { siren: "900111008", label: "TechFlow Studio", kind: "client" as const, codeNaf: "62.01Z", libelleNaf: "Programmation informatique", ville: "Lille", score: 68, severity: "modéré", statut: "actif", effectifTranche: "10 à 19 salariés", notes: "Studio de développement logiciel sur mesure." },
];
