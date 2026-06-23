import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useDeleteJournalEvent,
  useJournalEvents,
  type JournalEvent,
} from "@/api/journal";
import { cn } from "@/lib/utils";

// JournalPage — timeline des événements du tenant (JournalEventResource).
// Liste paginée (sort occurredAt,desc) avec filtre par kind. Les événements sont
// immuables en pratique, mais le DELETE JHipster reste disponible pour nettoyage.

const KIND_LABEL: Record<string, string> = {
  analysis: "Analyse",
  recommendation: "Recommandation",
  alert: "Alerte",
  decision: "Décision",
  document: "Document",
  workflow: "Workflow",
  system: "Système",
  user: "Utilisateur",
};

const KIND_FILTERS = [
  "analysis",
  "recommendation",
  "alert",
  "decision",
  "document",
  "workflow",
] as const;

const KIND_TONE: Record<string, string> = {
  analysis: "bg-primary/10 text-primary",
  recommendation: "bg-emerald-500/10 text-emerald-600",
  alert: "bg-red-500/10 text-red-600",
  decision: "bg-amber-500/10 text-amber-600",
  document: "bg-blue-500/10 text-blue-600",
  workflow: "bg-violet-500/10 text-violet-600",
  system: "bg-accent text-muted-foreground",
  user: "bg-accent text-muted-foreground",
};

function kindTone(kind: string): string {
  return KIND_TONE[kind] ?? "bg-accent text-muted-foreground";
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function EventRow({
  event,
  onDelete,
  pending,
}: {
  event: JournalEvent;
  onDelete: (id: number) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative pl-8 pb-6">
      {/* Ligne de timeline */}
      <span className="absolute left-[7px] top-1.5 bottom-0 w-px bg-border/60" />
      <span
        className={cn(
          "absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full ring-4 ring-background",
          kindTone(event.kind),
        )}
      />
      <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                  kindTone(event.kind),
                )}
              >
                {KIND_LABEL[event.kind] ?? event.kind}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatDateTime(event.occurredAt)}
              </span>
            </div>
            <h3 className="mt-1.5 text-sm font-bold text-foreground">
              {event.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onDelete(event.id)}
            disabled={pending}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-red-600 hover:bg-red-500/10 disabled:opacity-50 shrink-0"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {event.content && (
          <>
            <p
              className={cn(
                "mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap",
                !open && "line-clamp-2",
              )}
            >
              {event.content}
            </p>
            {event.content.length > 120 && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-1 text-[11px] font-bold text-primary hover:underline"
              >
                {open ? "Réduire" : "Voir plus"}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

const PAGE_SIZE = 25;

export default function JournalPage() {
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<string | undefined>(undefined);
  const { data, isLoading, isFetching, refetch } = useJournalEvents({
    page,
    size: PAGE_SIZE,
    kind,
  });
  const del = useDeleteJournalEvent();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Historique
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1 flex items-center gap-3">
            <History className="w-7 h-7 text-primary" />
            Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Traçabilité des événements de votre espace ({total} événement
            {total > 1 ? "s" : ""}).
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

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setKind(undefined);
            setPage(0);
          }}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
            !kind
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          Tous
        </button>
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setPage(0);
            }}
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
              kind === k
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucun événement{kind ? ` de type « ${KIND_LABEL[kind] ?? kind} »` : ""}{" "}
            pour le moment.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-2">
            {items.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onDelete={(id) => del.mutate(id)}
                pending={del.isPending}
              />
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                >
                  Suivant
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}