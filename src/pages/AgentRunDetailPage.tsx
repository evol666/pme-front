import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Bot,
  Brain,
  Clock,
  Cpu,
  Loader2,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  parseJsonArray,
  useAgentMessages,
  useAgentReasoningSteps,
  useAgentRun,
  useAgentSharedMemory,
  useDeleteAgentRun,
  type AgentRunStatus,
} from "@/api/agents";
import { cn } from "@/lib/utils";

// Détail d'un run d'agents (route /agents/:runId). Version Spring Boot : le run vient de
// GET /api/agent-runs/{id} (useAgentRun), les entités liées sont filtrées par `runId.equals`
// (useAgentMessages/useAgentReasoningSteps/useAgentSharedMemory). La suppression passe par
// DELETE /api/agent-runs/{id} (useDeleteAgentRun). La page v2 source utilisait des concepts
// FastAPI-only (consensus, outcome, modeBadge, ConsensusTimeline, SectionHeader, listAgents)
// qui n'ont pas d'équivalent Spring Boot — voir [[pme-migration-fastapi-only-endpoints]].

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

// Parse défensif d'un @Lob contenant un objet JSON (metadataJson). Renvoie null si absent
// ou mal formé.
function parseJsonObject(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export default function AgentRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const parsedId = runId ? Number(runId) : Number.NaN;
  const runIdNumber = Number.isFinite(parsedId) ? parsedId : null;

  const runQuery = useAgentRun(runIdNumber);
  const deleteMutation = useDeleteAgentRun();
  const [deleting, setDeleting] = useState(false);

  const run = runQuery.data ?? null;
  const metadata = useMemo(
    () => parseJsonObject(run?.metadataJson),
    [run?.metadataJson],
  );
  const agentIds = useMemo(() => parseJsonArray(run?.agentIds), [run?.agentIds]);

  const handleRefresh = () => {
    runQuery.refetch();
  };

  const handleDelete = async () => {
    if (!run) return;
    if (
      !globalThis.confirm(
        `Supprimer le run « ${run.topic} » (#${run.id}) ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(run.id);
      toast.success("Run supprimé.");
      navigate("/agents");
    } catch (err) {
      toast.error(extractBackendError(err));
    } finally {
      setDeleting(false);
    }
  };

  if (runIdNumber == null) {
    return (
      <ErrorState
        message="Identifiant de run invalide."
        onBack={() => navigate("/agents")}
      />
    );
  }

  if (runQuery.isLoading) {
    return <LoadingState onBack={() => navigate("/agents")} />;
  }

  if (runQuery.isError) {
    return (
      <ErrorState
        message={extractBackendError(runQuery.error)}
        onBack={() => navigate("/agents")}
        onRetry={handleRefresh}
      />
    );
  }

  if (!run) {
    return (
      <ErrorState message="Run introuvable." onBack={() => navigate("/agents")} />
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/agents")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                runQuery.isFetching && "animate-spin",
              )}
            />
            Actualiser
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Supprimer
          </button>
        </div>
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Bot className="h-4 w-4" />
          Orchestration IA
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {run.topic}
        </h1>
        <p className="text-sm text-muted-foreground">
          Run #{run.id} · {agentIds.length} agent{agentIds.length > 1 ? "s" : ""}
        </p>
      </header>

      {/* En-tête run */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeaderCard
          label="Statut"
          icon={
            <span
              className={cn("h-2 w-2 rounded-full", STATUS_DOT[run.status])}
            />
          }
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              STATUS_TONE[run.status],
            )}
          >
            {STATUS_LABEL[run.status]}
          </span>
        </HeaderCard>
        <HeaderCard label="Mode">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            <Cpu className="h-3 w-3" />
            {run.mode}
          </span>
        </HeaderCard>
        <HeaderCard label="Durée" icon={<Clock className="h-3.5 w-3.5" />}>
          <span className="text-lg font-semibold text-foreground tabular-nums">
            {formatDuration(run.durationMs)}
          </span>
        </HeaderCard>
        <HeaderCard label="Créé le">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {formatDateTime(run.createdAt)}
          </span>
        </HeaderCard>
      </div>

      {/* Question */}
      {run.question && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Question
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {run.question}
          </p>
        </section>
      )}

      {run.error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-medium">Erreur</p>
          <p className="mt-1 whitespace-pre-wrap line-clamp-6">{run.error}</p>
        </div>
      )}

      {agentIds.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Agents impliqués
          </p>
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
        </section>
      )}

      {metadata && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Métadonnées
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </section>
      )}

      {/* Timeline messages par turn */}
      <MessagesTimeline runId={run.id} />

      {/* Étapes de raisonnement */}
      <ReasoningSection runId={run.id} />

      {/* Mémoire partagée */}
      <SharedMemorySection runId={run.id} />

      <p className="text-xs text-muted-foreground">
        Démarré {formatDateTime(run.startedAt)} · Terminé{" "}
        {formatDateTime(run.finishedAt)}
      </p>
    </div>
  );
}

function HeaderCard({
  label,
  icon,
  children,
}: {
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-1.5">
      <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function MessagesTimeline({ runId }: { readonly runId: number }) {
  const messages = useAgentMessages(runId);

  const grouped = useMemo(() => {
    const list = messages.data ?? [];
    const byTurn = new Map<number, typeof list>();
    for (const m of list) {
      const arr = byTurn.get(m.turn) ?? [];
      arr.push(m);
      byTurn.set(m.turn, arr);
    }
    return Array.from(byTurn.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([turn, items]) => {
        const sortedItems = [...items].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        );
        return { turn, items: sortedItems };
      });
  }, [messages.data]);

  return (
    <section className="space-y-3">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare className="h-4 w-4 text-primary" />
        Messages
        <span className="text-xs font-normal text-muted-foreground">
          ({messages.data?.length ?? 0})
        </span>
      </h2>
      {messages.isLoading && <InlineLoader />}
      {!messages.isLoading && messages.isError && (
        <p className="text-sm text-destructive">
          {extractBackendError(messages.error)}
        </p>
      )}
      {!messages.isLoading && !messages.isError && grouped.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          Aucun message.
        </p>
      )}
      {!messages.isLoading && !messages.isError && grouped.length > 0 && (
        <ol className="space-y-4">
          {grouped.map(({ turn, items }) => (
            <li
              key={turn}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tour {turn} · {items.length} message{items.length > 1 ? "s" : ""}
              </p>
              <ol className="space-y-2">
                {items.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-border bg-background p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                        {m.agentId}
                      </span>
                      <span className="font-medium text-foreground">{m.role}</span>
                      <span>· {m.kind}</span>
                      {m.confidence != null && (
                        <span>· confiance {Math.round(m.confidence * 100)}%</span>
                      )}
                      <span className="ml-auto tabular-nums">
                        {formatDateTime(m.createdAt)}
                      </span>
                    </div>
                    {m.content && (
                      <p className="mt-2 whitespace-pre-wrap text-foreground line-clamp-6">
                        {m.content}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ReasoningSection({ runId }: { readonly runId: number }) {
  const reasoning = useAgentReasoningSteps(runId);

  return (
    <section className="space-y-3">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        <Brain className="h-4 w-4 text-primary" />
        Étapes de raisonnement
        <span className="text-xs font-normal text-muted-foreground">
          ({reasoning.data?.length ?? 0})
        </span>
      </h2>
      {reasoning.isLoading && <InlineLoader />}
      {!reasoning.isLoading && reasoning.isError && (
        <p className="text-sm text-destructive">
          {extractBackendError(reasoning.error)}
        </p>
      )}
      {!reasoning.isLoading &&
        !reasoning.isError &&
        (!reasoning.data || reasoning.data.length === 0) && (
          <p className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            Aucune étape de raisonnement.
          </p>
        )}
      {!reasoning.isLoading && !reasoning.isError && reasoning.data && reasoning.data.length > 0 && (
        <ol className="space-y-2">
          {reasoning.data.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                  {s.agentId}
                </span>
                <span className="font-medium text-foreground">{s.step}</span>
                <span className="ml-auto tabular-nums">
                  {formatDateTime(s.createdAt)}
                </span>
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
  );
}

function SharedMemorySection({ runId }: { readonly runId: number }) {
  const memory = useAgentSharedMemory(runId);

  return (
    <section className="space-y-3">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        <Cpu className="h-4 w-4 text-primary" />
        Mémoire partagée
        <span className="text-xs font-normal text-muted-foreground">
          ({memory.data?.length ?? 0})
        </span>
      </h2>
      {memory.isLoading && <InlineLoader />}
      {!memory.isLoading && memory.isError && (
        <p className="text-sm text-destructive">
          {extractBackendError(memory.error)}
        </p>
      )}
      {!memory.isLoading &&
        !memory.isError &&
        (!memory.data || memory.data.length === 0) && (
          <p className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            Aucune mémoire partagée.
          </p>
        )}
      {!memory.isLoading && !memory.isError && memory.data && memory.data.length > 0 && (
        <ul className="space-y-2">
          {memory.data.map((mem) => (
            <li
              key={mem.id}
              className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-accent px-1.5 py-0.5 font-medium text-accent-foreground">
                  {mem.scope}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {mem.key}
                </span>
                {mem.ttlSeconds != null && <span>· TTL {mem.ttlSeconds}s</span>}
                <span className="ml-auto tabular-nums">
                  {formatDateTime(mem.createdAt)}
                </span>
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

function LoadingState({ onBack }: { readonly onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement du run…
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onBack,
  onRetry,
}: {
  readonly message: string;
  readonly onBack: () => void;
  readonly onRetry?: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {message}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
      )}
    </div>
  );
}