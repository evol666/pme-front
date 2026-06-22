import { useMemo, useState } from "react";
import {
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import {
  parseJsonArray,
  useAgentMessages,
  useAgentReasoningSteps,
  useAgentRuns,
  useAgentSharedMemory,
  useDeleteAgentRun,
  type AgentRun,
  type AgentRunStatus,
} from "@/api/agents";
import { cn } from "@/lib/utils";

// Runs d'agents (LOT orchestration multi-agents). Version Spring Boot : liste le CRUD
// `/api/agent-runs` avec filtres Criteria (topic/status/mode), détail expansible par run
// affichant les messages, les étapes de raisonnement et la mémoire partagée (tous
// filtrés par `runId.equals`).

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  SUCCEEDED: "Réussi",
  FAILED: "Échec",
  CANCELED: "Annulé",
};

const STATUS_TONE: Record<AgentRunStatus, string> = {
  PENDING: "bg-slate-500/10 text-slate-600",
  RUNNING: "bg-sky-500/10 text-sky-600",
  SUCCEEDED: "bg-emerald-500/10 text-emerald-600",
  FAILED: "bg-red-500/10 text-red-600",
  CANCELED: "bg-muted text-muted-foreground",
};

const STATUS_DOT: Record<AgentRunStatus, string> = {
  PENDING: "bg-slate-500",
  RUNNING: "bg-sky-500 animate-pulse",
  SUCCEEDED: "bg-emerald-500",
  FAILED: "bg-red-500",
  CANCELED: "bg-muted-foreground/60",
};

const STATUS_FILTERS: { key: AgentRunStatus | ""; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "RUNNING", label: "En cours" },
  { key: "SUCCEEDED", label: "Réussis" },
  { key: "FAILED", label: "Échecs" },
  { key: "PENDING", label: "En attente" },
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

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentRunStatus | "">("");
  const [modeFilter, setModeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: runs, isLoading, refetch, isFetching } = useAgentRuns(
    appliedSearch || undefined,
    statusFilter || undefined,
    modeFilter || undefined,
  );
  const deleteMutation = useDeleteAgentRun();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
  };

  const handleDelete = async (run: AgentRun) => {
    if (!window.confirm(`Supprimer le run « ${run.topic} » ? Cette action est définitive.`)) {
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
          <Bot className="h-4 w-4" />
          Orchestration IA
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Runs d’agents</h1>
        <p className="max-w-2xl text-muted-foreground">
          Sessions d’orchestration multi-agents (DAG, débat, parallèle). Explorez chaque
          run pour voir la trace des messages, les étapes de raisonnement et la mémoire
          partagée.
        </p>
      </header>

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
                placeholder="Sujet du run…"
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Mode</span>
            <input
              type="text"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              placeholder="dag, debate…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
            />
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

      {isLoading ? (
        <LoadingState />
      ) : !runs || runs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onDelete={() => handleDelete(run)}
              deleting={deleteMutation.isPending && deleteMutation.variables === run.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  onDelete,
  deleting,
}: {
  run: AgentRun;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const agentIds = useMemo(() => parseJsonArray(run.agentIds), [run.agentIds]);

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
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[run.status])} />
                {STATUS_LABEL[run.status]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                <Cpu className="h-3 w-3" />
                {run.mode}
              </span>
              <span className="text-xs text-muted-foreground">#{run.id}</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{run.topic}</h3>
            {run.question && (
              <p className="text-sm text-muted-foreground line-clamp-2">{run.question}</p>
            )}
          </div>
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
        </header>

        {agentIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agentIds.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                <Bot className="h-3 w-3" />
                {a}
              </span>
            ))}
          </div>
        )}

        {run.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive line-clamp-3">
            {run.error}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Durée
            </dt>
            <dd className="mt-0.5 text-foreground">{formatDuration(run.durationMs)}</dd>
          </div>
          <div>
            <dt>Créé le</dt>
            <dd className="mt-0.5 text-foreground">{formatDateTime(run.createdAt)}</dd>
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

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {expanded ? "Masquer la trace" : "Voir la trace"}
        </button>
      </div>

      {expanded && <RunDetail runId={run.id} />}
    </article>
  );
}

function RunDetail({ runId }: { runId: number }) {
  const messages = useAgentMessages(runId);
  const reasoning = useAgentReasoningSteps(runId);
  const memory = useAgentSharedMemory(runId);

  return (
    <div className="space-y-6 border-t border-border p-5">
      <section className="space-y-3">
        <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          Messages
          <span className="text-xs font-normal text-muted-foreground">
            ({messages.data?.length ?? 0})
          </span>
        </h4>
        {messages.isLoading ? (
          <InlineLoader />
        ) : !messages.data || messages.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun message.</p>
        ) : (
          <ol className="space-y-2">
            {messages.data.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border bg-background p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Tour {m.turn}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {m.agentId}
                  </span>
                  <span>{m.role}</span>
                  <span>· {m.kind}</span>
                  {m.confidence != null && (
                    <span>· confiance {Math.round(m.confidence * 100)}%</span>
                  )}
                  <span className="ml-auto">{formatDateTime(m.createdAt)}</span>
                </div>
                {m.content && (
                  <p className="mt-2 whitespace-pre-wrap text-foreground line-clamp-6">
                    {m.content}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Brain className="h-4 w-4 text-primary" />
          Étapes de raisonnement
          <span className="text-xs font-normal text-muted-foreground">
            ({reasoning.data?.length ?? 0})
          </span>
        </h4>
        {reasoning.isLoading ? (
          <InlineLoader />
        ) : !reasoning.data || reasoning.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune étape de raisonnement.</p>
        ) : (
          <ol className="space-y-2">
            {reasoning.data.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-border bg-background p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {s.agentId}
                  </span>
                  <span className="font-medium text-foreground">{s.step}</span>
                  <span className="ml-auto">{formatDateTime(s.createdAt)}</span>
                </div>
                {s.thought && (
                  <p className="mt-2 whitespace-pre-wrap text-foreground line-clamp-5">
                    {s.thought}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Cpu className="h-4 w-4 text-primary" />
          Mémoire partagée
          <span className="text-xs font-normal text-muted-foreground">
            ({memory.data?.length ?? 0})
          </span>
        </h4>
        {memory.isLoading ? (
          <InlineLoader />
        ) : !memory.data || memory.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune mémoire partagée.</p>
        ) : (
          <ul className="space-y-2">
            {memory.data.map((mem) => (
              <li
                key={mem.id}
                className="rounded-lg border border-border bg-background p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-accent px-1.5 py-0.5 font-medium text-accent-foreground">
                    {mem.scope}
                  </span>
                  <span className="font-mono font-medium text-foreground">{mem.key}</span>
                  {mem.ttlSeconds != null && <span>· TTL {mem.ttlSeconds}s</span>}
                </div>
                {mem.value && (
                  <p className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground line-clamp-4">
                    {mem.value}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InlineLoader() {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Chargement…
    </div>
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
      <Bot className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">Aucun run d’agent</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aucun run ne correspond à votre recherche, ou l’historique est vide.
      </p>
    </div>
  );
}