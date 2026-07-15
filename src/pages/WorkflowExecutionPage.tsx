import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "lucide-react";

import {
  parseJsonObject,
  useWorkflowRun,
  useWorkflowSteps,
  useCancelWorkflowRun,
  useRetryWorkflowRun,
  type WorkflowRun,
  type WorkflowRunStatus,
  type WorkflowStep,
} from "@/api/workflows";
import { cn } from "@/lib/utils";

// WorkflowExecutionPage (LOT 14) — Détail d'un run. Version Spring Boot :
// GET /api/workflow-runs/{id} + GET /api/workflow-steps?runId.equals=… Timeline
// verticale des steps (orderIdx/stepId/status/duration). Les actions retry/cancel
// étaient portées par l'ancien FastAPI et ne sont pas migrées ici — voir
// [[pme-migration-fastapi-only-endpoints]].

const RUN_STATUS_LABEL: Record<WorkflowRunStatus, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  SUCCEEDED: "Réussi",
  FAILED: "Échec",
  CANCELED: "Annulé",
  RETRYING: "Retry",
};

const RUN_STATUS_TONE: Record<WorkflowRunStatus, string> = {
  PENDING: "bg-slate-500/10 text-slate-600",
  RUNNING: "bg-sky-500/10 text-sky-600",
  SUCCEEDED: "bg-emerald-500/10 text-emerald-600",
  FAILED: "bg-red-500/10 text-red-600",
  CANCELED: "bg-muted text-muted-foreground",
  RETRYING: "bg-amber-500/10 text-amber-600",
};

const RUN_STATUS_DOT: Record<WorkflowRunStatus, string> = {
  PENDING: "bg-slate-500",
  RUNNING: "bg-sky-500 animate-pulse",
  SUCCEEDED: "bg-emerald-500",
  FAILED: "bg-red-500",
  CANCELED: "bg-muted-foreground/60",
  RETRYING: "bg-amber-500 animate-pulse",
};

const STEP_TONE: Record<string, string> = {
  succeeded: "bg-emerald-500/10 text-emerald-600",
  running: "bg-sky-500/10 text-sky-600",
  failed: "bg-red-500/10 text-red-600",
  pending: "bg-slate-500/10 text-slate-600",
  skipped: "bg-muted text-muted-foreground",
};

const STEP_DOT: Record<string, string> = {
  succeeded: "bg-emerald-500",
  running: "bg-sky-500 animate-pulse",
  failed: "bg-red-500",
  pending: "bg-slate-500",
  skipped: "bg-muted-foreground/60",
};

const STEP_LABEL: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  succeeded: "Réussi",
  failed: "Échec",
  skipped: "Sauté",
};

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

export default function WorkflowExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const runId = useMemo(() => {
    const parsed = id ? Number(id) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [id]);

  const runQuery = useWorkflowRun(runId);
  const stepsQuery = useWorkflowSteps(runId);
  const cancelMutation = useCancelWorkflowRun();
  const retryMutation = useRetryWorkflowRun();

  const handleCancel = async () => {
    if (runId == null) return;
    try {
      await cancelMutation.mutateAsync(runId);
      runQuery.refetch();
      stepsQuery.refetch();
    } catch {
      // Ignorer ou gérer l'erreur localement
    }
  };

  const handleRetry = async () => {
    if (runId == null) return;
    try {
      const newRun = await retryMutation.mutateAsync(runId);
      navigate(`/workflows/runs/${newRun.id}`);
    } catch {
      // Ignorer ou gérer
    }
  };

  if (runId == null) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Identifiant de run invalide.
      </div>
    );
  }

  if (runQuery.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement du run…
      </div>
    );
  }

  if (runQuery.isError || !runQuery.data) {
    return (
      <div className="space-y-4">
        <BackLink onBack={() => navigate("/workflows")} />
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {runQuery.isError ? extractBackendError(runQuery.error) : "Run introuvable."}
        </div>
      </div>
    );
  }

  const run: WorkflowRun = runQuery.data;
  const outputs = parseJsonObject(run.outputs);
  const outputKeys = outputs ? Object.keys(outputs) : [];
  const steps: WorkflowStep[] = stepsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-3">
          <BackLink onBack={() => navigate("/workflows")} />
          <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            <PlayCircle className="h-4 w-4" />
            Run #{run.id}
          </p>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {run.workflowId}
          </h1>
          <p className="text-sm text-muted-foreground">
            Trigger <span className="font-medium text-foreground">{run.trigger}</span> ·
            créé le {formatDateTime(run.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(run.status === "PENDING" || run.status === "RUNNING" || run.status === "RETRYING") && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Annuler l'exécution"
              )}
            </button>
          )}
          {(run.status === "SUCCEEDED" || run.status === "FAILED" || run.status === "CANCELED") && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retryMutation.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {retryMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Relancer (Retry)"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Header : métriques */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Statut">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              RUN_STATUS_TONE[run.status],
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", RUN_STATUS_DOT[run.status])}
            />
            {RUN_STATUS_LABEL[run.status]}
          </span>
        </Metric>
        <Metric label="Durée">
          <span className="inline-flex items-center gap-1.5 text-foreground tabular-nums">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {formatDuration(run.durationMs)}
          </span>
        </Metric>
        <Metric label="Étapes">{steps.length}</Metric>
        <Metric label="Retries">
          <span className="text-foreground tabular-nums">{run.retries}</span>
        </Metric>
      </div>

      {run.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <b>Erreur :</b> {run.error}
        </div>
      )}

      {stepsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {extractBackendError(stepsQuery.error)}
        </div>
      )}

      {/* Timeline */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
          <button
            type="button"
            onClick={() => {
              void runQuery.refetch();
              void stepsQuery.refetch();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                (stepsQuery.isFetching || runQuery.isFetching) && "animate-spin",
              )}
            />
            Actualiser
          </button>
        </div>

        {stepsQuery.isLoading && (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des étapes…
          </div>
        )}
        {!stepsQuery.isLoading && steps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune étape exécutée pour ce run.
          </p>
        )}
        {!stepsQuery.isLoading && steps.length > 0 && (
          <ol className="relative ml-3 space-y-3 border-l-2 border-border pl-5">
            {steps.map((step, idx) => (
              <StepItem key={step.id} step={step} idx={idx} />
            ))}
          </ol>
        )}
      </section>

      {/* Outputs globaux */}
      {outputKeys.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Résultat</h2>
          <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
            {JSON.stringify(outputs, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function Metric({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">{children}</div>
    </div>
  );
}

function StepItem({ step, idx }: { readonly step: WorkflowStep; readonly idx: number }) {
  const tone = STEP_TONE[step.status] ?? "bg-muted text-muted-foreground";
  const dot = STEP_DOT[step.status] ?? "bg-muted-foreground/60";
  const label = STEP_LABEL[step.status] ?? step.status;
  const outputs = parseJsonObject(step.outputs);
  const outputKeys = outputs ? Object.keys(outputs) : [];

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[27px] mt-1 h-3 w-3 rounded-full border-2 border-background",
          dot,
        )}
        aria-hidden="true"
      />
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium text-foreground">
            <span className="mr-2 text-xs text-muted-foreground">{idx + 1}.</span>
            {step.label ?? step.stepId}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                tone,
              )}
            >
              {label}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(step.durationMs)}
            </span>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{step.stepId}</span>
          <span>· démarré {formatDateTime(step.startedAt)}</span>
          <span>· terminé {formatDateTime(step.finishedAt)}</span>
        </div>
        {step.error && (
          <p className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-600 line-clamp-3">
            {step.error}
          </p>
        )}
        {outputKeys.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Outputs ({outputKeys.length} clés)
            </summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
              {JSON.stringify(outputs, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </li>
  );
}

function BackLink({ onBack }: { readonly onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Retour au centre
    </button>
  );
}