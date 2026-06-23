import { useMemo, useState } from "react";
import { Brain, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractContentExcerpt,
  useMemoryDocuments,
  useMemoryEvents,
  type MemoryDocument,
  type MemoryEvent,
} from "@/api/memory";

// MemoireVivantePage — vue chronologique de la mémoire vivante (LOT migration
// Spring Boot). Backend : /api/memory-events (timeline) + /api/memory-documents
// (documents mémoire associés, version courte). Les endpoints sémantiques FastAPI
// (contradictions, similarités, évolutions, recherche vectorielle) ne sont pas
// migrés — on propose un explorateur chronologique CRUD filtrable.

const EVENT_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "observation", label: "Observation" },
  { value: "decision", label: "Décision" },
  { value: "feedback", label: "Feedback" },
  { value: "insight", label: "Insight" },
  { value: "context", label: "Contexte" },
  { value: "other", label: "Autre" },
];

const EVENT_KIND_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_KIND_OPTIONS.map((k) => [k.value, k.label]),
);

const EVENT_KIND_TONE: Record<string, string> = {
  observation: "bg-sky-500/10 text-sky-600",
  decision: "bg-emerald-500/10 text-emerald-600",
  feedback: "bg-amber-500/10 text-amber-600",
  insight: "bg-primary/10 text-primary",
  context: "bg-slate-500/10 text-slate-600",
  other: "bg-muted text-muted-foreground",
};

function kindLabel(kind: string): string {
  return EVENT_KIND_LABEL[kind] ?? kind;
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

export default function MemoireVivantePage() {
  const [kindFilter, setKindFilter] = useState("");
  const [eventKindFilter, setEventKindFilter] = useState("");

  const eventsQuery = useMemoryEvents({
    kind: eventKindFilter || undefined,
  });
  const documentsQuery = useMemoryDocuments({
    kind: kindFilter || undefined,
    status: "active",
  });

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const documents = useMemo(
    () => (documentsQuery.data ?? []).slice(0, 6),
    [documentsQuery.data],
  );

  function handleRefresh() {
    eventsQuery.refetch();
    documentsQuery.refetch();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Brain className="h-3.5 w-3.5" />
          Mémoire vivante
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          La mémoire stratégique de votre entreprise
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Timeline des événements mémoire (observations, décisions, feedback) et
          documents associés. L'IA y détecte les récurrences et l'évolution
          stratégique — pour éviter de répéter sans le savoir, ou d'oublier ce
          que vous avez déjà construit.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={eventKindFilter}
          onChange={(e) => setEventKindFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Tous les types d'événement</option>
          {EVENT_KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        <span className="text-xs text-muted-foreground tabular-nums">
          {events.length} événement{events.length > 1 ? "s" : ""}
        </span>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={eventsQuery.isFetching || documentsQuery.isFetching}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              (eventsQuery.isFetching || documentsQuery.isFetching) &&
                "animate-spin",
            )}
          />
          Actualiser
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Timeline des événements */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Événements mémoire
          </h2>

          {eventsQuery.isLoading ? (
            <LoadingState label="Chargement des événements…" />
          ) : eventsQuery.isError ? (
            <ErrorState
              message={extractBackendError(eventsQuery.error)}
              onRetry={() => eventsQuery.refetch()}
            />
          ) : events.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="Aucun événement mémoire"
              message="La mémoire se construit au fil de vos briefings, livrables et feedbacks. Aucun événement ne correspond à ces filtres."
            />
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ol>
          )}
        </section>

        {/* Documents mémoire associés */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Documents associés
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {documentsQuery.data?.length ?? 0}
            </span>
          </div>

          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Tous les types</option>
            <option value="expertise">Expertise</option>
            <option value="context">Contexte</option>
            <option value="preference">Préférence</option>
            <option value="other">Autre</option>
          </select>

          {documentsQuery.isLoading ? (
            <LoadingState label="Chargement des documents…" />
          ) : documentsQuery.isError ? (
            <ErrorState
              message={extractBackendError(documentsQuery.error)}
              onRetry={() => documentsQuery.refetch()}
            />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="Aucun document"
              message="Aucun document mémoire actif ne correspond à ces filtres."
            />
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <DocumentMiniCard document={doc} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: MemoryEvent }) {
  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              EVENT_KIND_TONE[event.kind] ?? "bg-muted text-muted-foreground",
            )}
          >
            {kindLabel(event.kind)}
          </span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {formatDateTime(event.createdAt)}
          </span>
        </div>

        {event.summary ? (
          <p className="text-sm text-foreground line-clamp-4 whitespace-pre-line">
            {event.summary}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Événement sans résumé.
          </p>
        )}
      </div>
    </li>
  );
}

function DocumentMiniCard({ document }: { document: MemoryDocument }) {
  const excerpt = extractContentExcerpt(document.content, 180);
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {document.kind}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground line-clamp-1">
        {document.title}
      </h3>
      {excerpt && (
        <p className="text-xs text-muted-foreground line-clamp-2">{excerpt}</p>
      )}
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {formatDateTime(document.createdAt)}
      </span>
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