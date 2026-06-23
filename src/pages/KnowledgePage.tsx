import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDeleteKnowledgeEntity,
  useDeleteKnowledgeSignal,
  useKnowledgeEntities,
  useKnowledgeSignals,
  useResolveKnowledgeSignal,
  type AlertSeverity,
  type KnowledgeEntity,
  type KnowledgeSignal,
} from "@/api/knowledge";

// KnowledgePage — Mémoire stratégique (LOT 16), version Spring Boot CRUD.
// Backend : /api/knowledge-entities + /api/knowledge-signals (CRUD JHipster). Le graphe
// interactif FastAPI (/graph, /search, /stats, /scan) n'est pas migré — on propose un
// explorateur d'entités filtrable + un centre de signaux résolvables.

type Tab = "signals" | "entities";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "company", label: "Entreprise" },
  { value: "contact", label: "Contact" },
  { value: "supplier", label: "Fournisseur" },
  { value: "candidate", label: "Candidat" },
  { value: "project", label: "Projet" },
  { value: "workflow", label: "Workflow" },
  { value: "alert", label: "Alerte" },
  { value: "recommendation", label: "Recommandation" },
  { value: "other", label: "Autre" },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  KIND_OPTIONS.map((k) => [k.value, k.label]),
);

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  INFO: "Info",
  LOW: "Faible",
  MEDIUM: "Moyen",
  HIGH: "Élevé",
  CRITICAL: "Critique",
};

const SEVERITY_TONE: Record<AlertSeverity, string> = {
  INFO: "bg-slate-500/10 text-slate-600",
  LOW: "bg-sky-500/10 text-sky-600",
  MEDIUM: "bg-amber-500/10 text-amber-600",
  HIGH: "bg-orange-500/10 text-orange-600",
  CRITICAL: "bg-red-500/10 text-red-600",
};

const SIGNAL_STATUS_LABEL: Record<string, string> = {
  open: "Ouvert",
  resolved: "Résolu",
};

const SIGNAL_STATUS_TONE: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600",
  resolved: "bg-emerald-500/10 text-emerald-600",
};

const SEVERITY_FILTERS: { value: AlertSeverity; label: string }[] = [
  { value: "CRITICAL", label: "Critique" },
  { value: "HIGH", label: "Élevé" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "LOW", label: "Faible" },
  { value: "INFO", label: "Info" },
];

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// Les champs @Lob tags/entityIds/attributes sont des chaînes JSON sérialisées.
function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
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

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("signals");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <BrainCircuit className="h-3.5 w-3.5" />
          Mémoire stratégique
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Graphe de connaissance
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Entreprises, contacts, fournisseurs, candidats, projets — et les signaux
          faibles qui y sont rattachés. Résolvez les signaux et explorez les entités
          connues.
        </p>
      </header>

      <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-sm">
        <TabButton active={tab === "signals"} onClick={() => setTab("signals")}>
          <AlertTriangle className="h-4 w-4" />
          Signaux
        </TabButton>
        <TabButton active={tab === "entities"} onClick={() => setTab("entities")}>
          <Tag className="h-4 w-4" />
          Entités
        </TabButton>
      </div>

      {tab === "signals" ? <SignalsPanel /> : <EntitiesPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ─── Signaux ───────────────────────────────────────────────────────────────

function SignalsPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "">("");
  const [kindFilter, setKindFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signalsQuery = useKnowledgeSignals(
    statusFilter || undefined,
    kindFilter.trim() || undefined,
    severityFilter || undefined,
  );
  const resolveMutation = useResolveKnowledgeSignal();
  const deleteMutation = useDeleteKnowledgeSignal();

  const signals = useMemo(() => signalsQuery.data ?? [], [signalsQuery.data]);

  async function handleResolve(id: number) {
    setError(null);
    try {
      await resolveMutation.mutateAsync(id);
    } catch (e) {
      setError(extractBackendError(e));
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setError(extractBackendError(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
          {[
            { value: "", label: "Tous" },
            { value: "open", label: "Ouverts" },
            { value: "resolved", label: "Résolus" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                statusFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | "")}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Toutes sévérités</option>
          {SEVERITY_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <input
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          placeholder="Filtrer par type (ex. risk, trend)…"
          className="flex-1 min-w-[200px] rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        <button
          type="button"
          onClick={() => signalsQuery.refetch()}
          disabled={signalsQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-4 w-4", signalsQuery.isFetching && "animate-spin")}
          />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {signalsQuery.isLoading ? (
        <LoadingState label="Chargement des signaux…" />
      ) : signalsQuery.isError ? (
        <ErrorState
          message={extractBackendError(signalsQuery.error)}
          onRetry={() => signalsQuery.refetch()}
        />
      ) : signals.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Aucun signal"
          message="Aucun signal ne correspond à ces filtres. Lancez un scan côté serveur ou élargissez les critères."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onResolve={handleResolve}
              onDelete={handleDelete}
              resolving={
                resolveMutation.isPending && resolveMutation.variables === signal.id
              }
              deleting={
                deleteMutation.isPending && deleteMutation.variables === signal.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({
  signal,
  onResolve,
  onDelete,
  resolving,
  deleting,
}: {
  signal: KnowledgeSignal;
  onResolve: (id: number) => void;
  onDelete: (id: number) => void;
  resolving: boolean;
  deleting: boolean;
}) {
  const entityIds = parseJsonArray(signal.entityIds);
  const isOpen = signal.status !== "resolved";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            SEVERITY_TONE[signal.severity],
          )}
        >
          {SEVERITY_LABEL[signal.severity]}
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {signal.kind}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            SIGNAL_STATUS_TONE[signal.status] ?? "bg-muted text-muted-foreground",
          )}
        >
          {SIGNAL_STATUS_LABEL[signal.status] ?? signal.status}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Score {signal.score.toFixed(2)}
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{signal.title}</h3>
        {signal.summary && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {signal.summary}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Détecté {formatDateTime(signal.createdAt)}</span>
        {signal.resolvedAt && (
          <span className="text-emerald-600">
            Résolu {formatDateTime(signal.resolvedAt)}
          </span>
        )}
        {entityIds.length > 0 && <span>{entityIds.length} entité(s) liée(s)</span>}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {isOpen && (
          <button
            type="button"
            onClick={() => onResolve(signal.id)}
            disabled={resolving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {resolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Marquer résolu
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(signal.id)}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ─── Entités ───────────────────────────────────────────────────────────────

function EntitiesPanel() {
  const [kindFilter, setKindFilter] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entitiesQuery = useKnowledgeEntities(
    kindFilter || undefined,
    undefined,
    appliedSearch.trim() || undefined,
  );
  const deleteMutation = useDeleteKnowledgeEntity();

  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await deleteMutation.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
    } catch (e2) {
      setError(extractBackendError(e2));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Tous les types</option>
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        <form onSubmit={submitSearch} className="flex flex-1 min-w-[220px] gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par libellé…"
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
          >
            Rechercher
          </button>
        </form>

        <button
          type="button"
          onClick={() => entitiesQuery.refetch()}
          disabled={entitiesQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-4 w-4", entitiesQuery.isFetching && "animate-spin")}
          />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {entitiesQuery.isLoading ? (
        <LoadingState label="Chargement des entités…" />
      ) : entitiesQuery.isError ? (
        <ErrorState
          message={extractBackendError(entitiesQuery.error)}
          onRetry={() => entitiesQuery.refetch()}
        />
      ) : entities.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-8 w-8" />}
          title="Aucune entité"
          message="Aucune entité ne correspond à ces filtres."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              selected={selectedId === entity.id}
              onSelect={() =>
                setSelectedId(selectedId === entity.id ? null : entity.id)
              }
              onDelete={handleDelete}
              deleting={
                deleteMutation.isPending && deleteMutation.variables === entity.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityCard({
  entity,
  selected,
  onSelect,
  onDelete,
  deleting,
}: {
  entity: KnowledgeEntity;
  selected: boolean;
  onSelect: () => void;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const tags = parseJsonArray(entity.tags);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition",
        selected ? "border-primary/60 ring-2 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {kindLabel(entity.kind)}
        </span>
        {entity.status && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {entity.status}
          </span>
        )}
        {entity.score != null && (
          <span className="ml-auto text-xs text-muted-foreground">
            Score {entity.score.toFixed(2)}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{entity.label}</h3>
        {entity.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {entity.description}
          </p>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((t) => (
            <span
              key={t}
              className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground"
            >
              {t}
            </span>
          ))}
          {tags.length > 6 && (
            <span className="text-xs text-muted-foreground">
              +{tags.length - 6}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {entity.source && <span>Source : {entity.source}</span>}
        <span>Vu {formatDateTime(entity.lastSeenAt)}</span>
      </div>

      {selected && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          {entity.externalId && (
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">ID externe :</span>{" "}
              {entity.externalId}
            </div>
          )}
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Vu la 1re fois :</span>{" "}
            {formatDateTime(entity.firstSeenAt)}
          </div>
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Mis à jour :</span>{" "}
            {formatDateTime(entity.updatedAt)}
          </div>
          {entity.attributes && (
            <pre className="overflow-x-auto rounded-lg bg-background p-2 text-xs text-muted-foreground">
              {entity.attributes}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
        >
          {selected ? "Masquer le détail" : "Voir le détail"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(entity.id)}
          disabled={deleting}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ─── États partagés ─────────────────────────────────────────────────────────

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground shadow-sm">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
      <p className="text-sm text-red-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Réessayer
      </button>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}