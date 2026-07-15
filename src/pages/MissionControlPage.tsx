import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  useCreatePriority,
  useDeletePriority,
  useUpdatePriorityStatus,
  useUserPriorities,
  type UserPriority,
  type UserPriorityHorizon,
  type UserPriorityKind,
  type UserPriorityStatus,
} from "@/api/priorities";
import { cn } from "@/lib/utils";

// MissionControlPage — tableau de pilotage des priorités stratégiques utilisateur.
// Backend : /api/user-priorities (CRUD JHipster) + /api/copilot/v2/priorities
// (création, injecte tenant/user côté backend). On regroupe les priorités par
// horizon (semaine/mois/trimestre/année) avec actions de statut (atteinte /
// abandonnée / réactiver) et suppression.

const KIND_OPTIONS: { value: UserPriorityKind; label: string; hint: string }[] = [
  { value: "GOAL", label: "Objectif", hint: "Résultat mesurable à atteindre" },
  { value: "FOCUS", label: "Focus", hint: "Zone d'attention prioritaire" },
  { value: "INTENT", label: "Intention", hint: "Direction sans cible chiffrée" },
];

const HORIZON_ORDER: UserPriorityHorizon[] = ["WEEK", "MONTH", "QUARTER", "YEAR"];

const HORIZON_LABEL: Record<UserPriorityHorizon, string> = {
  WEEK: "Cette semaine",
  MONTH: "Ce mois-ci",
  QUARTER: "Ce trimestre",
  YEAR: "Cette année",
};

const KIND_LABEL: Record<UserPriorityKind, string> = {
  GOAL: "Objectif",
  FOCUS: "Focus",
  INTENT: "Intention",
};

const STATUS_LABEL: Record<UserPriorityStatus, string> = {
  active: "Active",
  achieved: "Atteinte",
  dropped: "Abandonnée",
};

const STATUS_TONE: Record<UserPriorityStatus, string> = {
  active: "bg-primary/10 text-primary",
  achieved: "bg-emerald-500/10 text-emerald-600",
  dropped: "bg-red-500/10 text-red-600",
};

const STATUS_FILTERS: { value: UserPriorityStatus; label: string }[] = [
  { value: "active", label: "Actives" },
  { value: "achieved", label: "Atteintes" },
  { value: "dropped", label: "Abandonnées" },
];

function priorityStatus(value: string): UserPriorityStatus {
  if (value === "achieved" || value === "dropped") return value;
  return "active";
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      dateStyle: "medium",
    });
  } catch {
    return iso;
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

function PriorityCard({
  priority,
  onStatus,
  onDelete,
  pending,
}: {
  readonly priority: UserPriority;
  readonly onStatus: (id: number, status: UserPriorityStatus) => void;
  readonly onDelete: (id: number) => void;
  readonly pending: boolean;
}) {
  const status = priorityStatus(priority.status);
  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-muted-foreground">
              {KIND_LABEL[priority.kind]}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                STATUS_TONE[status],
              )}
            >
              {STATUS_LABEL[status]}
            </span>
            {priority.source === "copilot" && (
              <span className="text-[10px] font-medium text-primary">
                Suggéré par le copilote
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-bold text-foreground">
            {priority.label ?? "(sans libellé)"}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onDelete(priority.id)}
          disabled={pending}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-red-600 hover:bg-red-500/10 disabled:opacity-50 shrink-0"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground">
          Poids {priority.weight} · créée le {formatDateTime(priority.createdAt)}
        </div>
        <div className="flex items-center gap-1.5">
          {status === "active" && (
            <>
              <button
                type="button"
                onClick={() => onStatus(priority.id, "achieved")}
                disabled={pending}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50"
                title="Marquer comme atteinte"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Atteinte
              </button>
              <button
                type="button"
                onClick={() => onStatus(priority.id, "dropped")}
                disabled={pending}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                title="Abandonner"
              >
                <X className="w-3.5 h-3.5" />
                Abandonner
              </button>
            </>
          )}
          {status !== "active" && (
            <button
              type="button"
              onClick={() => onStatus(priority.id, "active")}
              disabled={pending}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
              title="Réactiver"
            >
              <CircleDot className="w-3.5 h-3.5" />
              Réactiver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MissionControlPage() {
  const [statusFilter, setStatusFilter] = useState<UserPriorityStatus>("active");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<UserPriorityKind>("GOAL");
  const [horizon, setHorizon] = useState<UserPriorityHorizon>("MONTH");
  const [weight, setWeight] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } =
    useUserPriorities(statusFilter);
  const create = useCreatePriority();
  const updateStatus = useUpdatePriorityStatus();
  const del = useDeletePriority();

  const priorities = useMemo(() => data ?? [], [data]);

  // Regroupement par horizon (ordre canonique).
  const grouped = useMemo(() => {
    const map: Record<UserPriorityHorizon, UserPriority[]> = {
      WEEK: [],
      MONTH: [],
      QUARTER: [],
      YEAR: [],
    };
    for (const p of priorities) {
      const h = p.horizon;
      if (map[h]) map[h].push(p);
    }
    return map;
  }, [priorities]);

  const totalActive = useMemo(
    () => priorities.filter((p) => priorityStatus(p.status) === "active").length,
    [priorities],
  );

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmed = label.trim();
    if (!trimmed) {
      setFormError("Le libellé est obligatoire.");
      return;
    }
    try {
      await create.mutateAsync({
        label: trimmed,
        kind,
        horizon,
        weight,
      });
      setLabel("");
      setWeight(5);
    } catch (err) {
      setFormError(extractBackendError(err));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Pilotage
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1 flex items-center gap-3">
            <Target className="w-7 h-7 text-primary" />
            Mission Control
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Déclarez vos priorités stratégiques et guidez le copilote vers ce qui
            compte.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Rafraîchir
        </button>
      </header>

      {/* Formulaire de création */}
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Plus className="w-4 h-4 text-primary" />
          Nouvelle priorité
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Libellé
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. Signer 3 nouveaux clients ce trimestre"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Type
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as UserPriorityKind)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Horizon
            </label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as UserPriorityHorizon)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {HORIZON_ORDER.map((h) => (
                <option key={h} value={h}>
                  {HORIZON_LABEL[h]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Poids ({weight})
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
        {formError && (
          <p className="text-xs font-medium text-red-600">
            {formError}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Ajouter
          </button>
        </div>
      </form>

      {/* Filtres statut */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
            statusFilter === "active"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          Actives
        </button>
        {STATUS_FILTERS.filter((s) => s.value !== "active").map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
              statusFilter === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {totalActive} active{totalActive > 1 ? "s" : ""}
        </span>
      </div>

      {/* Liste groupée par horizon */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement…
        </div>
      )}
      {!isLoading && priorities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucune priorité {STATUS_LABEL[statusFilter].toLowerCase()} pour le
            moment. Déclarez-en une ci-dessus.
          </p>
        </div>
      )}
      {!isLoading && priorities.length > 0 && (
        <div className="space-y-6">
          {HORIZON_ORDER.map((h) => {
            const items = grouped[h];
            if (items.length === 0) return null;
            return (
              <section key={h} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {HORIZON_LABEL[h]} · {items.length}
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {items.map((p) => (
                    <PriorityCard
                      key={p.id}
                      priority={p}
                      onStatus={(id, s) => updateStatus.mutate({ id, status: s })}
                      onDelete={(id) => del.mutate(id)}
                      pending={updateStatus.isPending || del.isPending}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}