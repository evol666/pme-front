import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Workflow,
} from "lucide-react";

import {
  parseJsonObject,
  useDeleteWorkflowRun,
  useWorkflowRuns,
  useRunWorkflow,
  type WorkflowRun,
  type WorkflowRunStatus,
} from "@/api/workflows";
import { cn } from "@/lib/utils";

// WorkflowsPage (LOT 14) — Centre de workflows. Version Spring Boot : liste le
// CRUD `/api/workflow-runs` avec filtres Criteria (workflowId.contains +
// status.equals), cartes par run avec champs @Lob parsés (outputs/error) et
// lien vers le détail `/workflows/runs/:id`. Le catalogue exécutable et les
// actions run/retry/cancel étaient portés par l'ancien FastAPI et ne sont pas
// migrés ici — voir [[pme-migration-fastapi-only-endpoints]].

const STATUS_LABEL: Record<WorkflowRunStatus, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  SUCCEEDED: "Réussi",
  FAILED: "Échec",
  CANCELED: "Annulé",
  RETRYING: "Retry",
};

const STATUS_TONE: Record<WorkflowRunStatus, string> = {
  PENDING: "bg-slate-500/10 text-slate-600",
  RUNNING: "bg-sky-500/10 text-sky-600",
  SUCCEEDED: "bg-emerald-500/10 text-emerald-600",
  FAILED: "bg-red-500/10 text-red-600",
  CANCELED: "bg-muted text-muted-foreground",
  RETRYING: "bg-amber-500/10 text-amber-600",
};

const STATUS_DOT: Record<WorkflowRunStatus, string> = {
  PENDING: "bg-slate-500",
  RUNNING: "bg-sky-500 animate-pulse",
  SUCCEEDED: "bg-emerald-500",
  FAILED: "bg-red-500",
  CANCELED: "bg-muted-foreground/60",
  RETRYING: "bg-amber-500 animate-pulse",
};

const STATUS_FILTERS: { key: WorkflowRunStatus | ""; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "RUNNING", label: "En cours" },
  { key: "SUCCEEDED", label: "Réussis" },
  { key: "FAILED", label: "Échecs" },
  { key: "PENDING", label: "En attente" },
  { key: "RETRYING", label: "Retry" },
  { key: "CANCELED", label: "Annulés" },
];

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
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

export default function WorkflowsPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowRunStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const { data: runs, isLoading, refetch, isFetching } = useWorkflowRuns(
    appliedSearch || undefined,
    statusFilter || undefined,
  );
  const deleteMutation = useDeleteWorkflowRun();
  const runMutation = useRunWorkflow();
  const navigate = useNavigate();

  const handleRun = async (workflowId: string) => {
    setRunningId(workflowId);
    setError(null);
    try {
      const run = await runMutation.mutateAsync({ workflowId });
      navigate(`/workflows/runs/${run.id}`);
    } catch (err) {
      setError(extractBackendError(err));
    } finally {
      setRunningId(null);
    }
  };

  const submitSearch = (e: React.SubmitEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
  };

  const handleDelete = async (run: WorkflowRun) => {
    if (
      !globalThis.confirm(
        `Supprimer le run « ${run.workflowId} » #${run.id} ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteMutation.mutateAsync(run.id);
    } catch (err) {
      setError(extractBackendError(err));
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Workflow className="h-4 w-4" />
          Automatisations
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Centre de workflows
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Historique des exécutions de workflows. Chaque run produit un livrable et
          expose sa trace d’étapes. Cliquez sur un run pour ouvrir la timeline détaillée.
        </p>
      </header>

      {/* Catalogue de templates */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Catalogue de workflows exécutables</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">📊</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">Audit financier automatisé</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Analyse de la liasse fiscale et des comptes bancaires pour extraire le score de solvabilité.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={runningId !== null}
              onClick={() => handleRun("audit-financier")}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {runningId === "audit-financier" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exécution...
                </>
              ) : (
                "Lancer le workflow"
              )}
            </button>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">🤝</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">Onboarding client premium</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Génération des documents contractuels et lancement du diagnostic d'onboarding.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={runningId !== null}
              onClick={() => handleRun("onboarding-client")}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {runningId === "onboarding-client" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exécution...
                </>
              ) : (
                "Lancer le workflow"
              )}
            </button>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">⚖️</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">Conformité réglementaire</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Analyse des textes légaux et validation de la conformité juridique de l'entreprise.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={runningId !== null}
              onClick={() => handleRun("compliance-legal")}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {runningId === "compliance-legal" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exécution...
                </>
              ) : (
                "Lancer le workflow"
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Filtres */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Recherche</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Identifiant de workflow…"
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Filtrer
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Actualiser
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key || "all"}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {isLoading && <LoadingState />}
      {!isLoading && (!runs || runs.length === 0) && <EmptyState />}
      {!isLoading && runs && runs.length > 0 && (
        <div className="space-y-4">
          {runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onOpen={() => navigate(`/workflows/runs/${run.id}`)}
              onDelete={() => handleDelete(run)}
              deleting={
                deleteMutation.isPending && deleteMutation.variables === run.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  onOpen,
  onDelete,
  deleting,
}: {
  readonly run: WorkflowRun;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
  readonly deleting: boolean;
}) {
  const outputs = parseJsonObject(run.outputs);
  const outputKeys = outputs ? Object.keys(outputs) : [];

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  STATUS_TONE[run.status],
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[run.status])}
                />
                {STATUS_LABEL[run.status]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                {run.trigger}
              </span>
              <span className="text-xs text-muted-foreground">#{run.id}</span>
            </div>
            <h3 className="font-mono text-base font-semibold text-foreground">
              {run.workflowId}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Détail
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Supprimer
            </button>
          </div>
        </header>

        {run.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive line-clamp-3">
            {run.error}
          </p>
        )}

        {outputKeys.length > 0 && (
          <details className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Outputs ({outputKeys.length} clés)
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
              {JSON.stringify(outputs, null, 2)}
            </pre>
          </details>
        )}

        <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Durée
            </dt>
            <dd className="mt-0.5 text-foreground tabular-nums">
              {formatDuration(run.durationMs)}
            </dd>
          </div>
          <div>
            <dt>Retries</dt>
            <dd className="mt-0.5 text-foreground tabular-nums">{run.retries}</dd>
          </div>
          <div>
            <dt>Démarré</dt>
            <dd className="mt-0.5 text-foreground">{formatDateTime(run.startedAt)}</dd>
          </div>
          <div>
            <dt>Terminé</dt>
            <dd className="mt-0.5 text-foreground">{formatDateTime(run.finishedAt)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement des runs…
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Workflow className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">Aucun run de workflow</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aucun run ne correspond à votre recherche, ou l’historique est vide.
      </p>
    </div>
  );
}