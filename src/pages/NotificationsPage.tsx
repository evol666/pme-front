import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  MailCheck,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  parseNotificationChannels,
  useDeleteNotification,
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotificationDigests,
  useNotifications,
  useRefreshNotificationCenter,
  useUnreadNotificationCount,
  type Notification,
  type NotificationKind,
  type NotificationPriority,
  type NotificationStatus,
} from "@/api/notifications";
import { cn } from "@/lib/utils";

// NotificationsPage — /notifications. Centre de notifications (LOT 10).
// Version Spring Boot : liste paginée via NotificationResource (/api/notifications,
// Criteria + Pageable), actions read/unread/dismiss/delete via PATCH merge-patch,
// centre de notifications (unread-count, refresh, read-all) via
// NotificationCenterResource, et digests via NotificationDigestResource.

const KIND_LABEL: Record<NotificationKind, string> = {
  ALERT: "Alerte",
  NBA: "Action prioritaire",
  DIGEST: "Digest",
  WORKFLOW: "Workflow",
};

const KIND_ICON: Record<NotificationKind, React.ReactNode> = {
  ALERT: <AlertTriangle className="h-3.5 w-3.5" />,
  NBA: <Zap className="h-3.5 w-3.5" />,
  DIGEST: <Sparkles className="h-3.5 w-3.5" />,
  WORKFLOW: <CheckCheck className="h-3.5 w-3.5" />,
};

const KIND_TONE: Record<NotificationKind, string> = {
  ALERT: "bg-red-500/10 text-red-600",
  NBA: "bg-amber-500/10 text-amber-600",
  DIGEST: "bg-sky-500/10 text-sky-600",
  WORKFLOW: "bg-emerald-500/10 text-emerald-600",
};

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  CRITICAL: "Critique",
  HIGH: "Important",
  MEDIUM: "Moyen",
  LOW: "Info",
};

const PRIORITY_TONE: Record<NotificationPriority, string> = {
  CRITICAL: "bg-red-500/10 text-red-600",
  HIGH: "bg-orange-500/10 text-orange-600",
  MEDIUM: "bg-sky-500/10 text-sky-600",
  LOW: "bg-slate-500/10 text-slate-600",
};

const STATUS_LABEL: Record<NotificationStatus, string> = {
  PENDING: "En attente",
  QUEUED: "En file",
  SENT: "Envoyé",
  DELIVERED: "Livré",
  READ: "Lu",
  DISMISSED: "Ignoré",
  FAILED: "Échec",
  GROUPED: "Groupé",
};

type StatusFilter = "active" | "all" | "read" | "dismissed";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "Actives" },
  { key: "all", label: "Toutes" },
  { key: "read", label: "Lues" },
  { key: "dismissed", label: "Ignorées" },
];

const PAGE_SIZE = 20;

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

// Map un filtre de statut UX → paramètre Criteria backend.
function statusToCriteria(
  filter: StatusFilter,
): NotificationStatus | undefined {
  if (filter === "read") return "READ";
  if (filter === "dismissed") return "DISMISSED";
  return undefined; // "active" et "all" : on ne filtre pas par status.equals
}

export default function NotificationsPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [kindFilter, setKindFilter] = useState<NotificationKind | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<
    NotificationPriority | "all"
  >("all");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useNotifications({
    page,
    size: PAGE_SIZE,
    sort: "createdAt,desc",
    status: statusToCriteria(statusFilter),
    kind: kindFilter === "all" ? undefined : kindFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    search: appliedSearch || undefined,
  });
  const unread = useUnreadNotificationCount();
  const digests = useNotificationDigests();

  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const dismiss = useDismissNotification();
  const deleteMutation = useDeleteNotification();
  const markAll = useMarkAllNotificationsRead();
  const refreshCenter = useRefreshNotificationCenter();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submitSearch = (e: React.SubmitEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
    setPage(0);
  };

  const handleMarkRead = async (n: Notification) => {
    setError(null);
    try {
      await markRead.mutateAsync(n.id);
      toast.success("Notification marquée comme lue.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleMarkUnread = async (n: Notification) => {
    setError(null);
    try {
      await markUnread.mutateAsync(n.id);
      toast.success("Notification marquée comme non lue.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDismiss = async (n: Notification) => {
    setError(null);
    try {
      await dismiss.mutateAsync(n.id);
      toast.success("Notification ignorée.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDelete = async (n: Notification) => {
    const titleLabel = n.title ?? `#${n.id}`;
    if (
      !globalThis.confirm(
        `Supprimer la notification « ${titleLabel} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteMutation.mutateAsync(n.id);
      toast.success("Notification supprimée.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleMarkAll = async () => {
    setError(null);
    try {
      await markAll.mutateAsync();
      toast.success("Toutes les notifications ont été marquées comme lues.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleRefreshCenter = async () => {
    setError(null);
    try {
      await refreshCenter.mutateAsync();
      toast.success("Centre de notifications rafraîchi.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const resetFilters = () => {
    setStatusFilter("active");
    setKindFilter("all");
    setPriorityFilter("all");
    setSearch("");
    setAppliedSearch("");
    setPage(0);
  };

  const hasActiveFilters =
    statusFilter !== "active" ||
    kindFilter !== "all" ||
    priorityFilter !== "all" ||
    appliedSearch !== "";

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Bell className="h-4 w-4" />
          Copilote · Notifications
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Centre de notifications
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              L’IA surveille vos signaux et vous notifie uniquement de
              l’important. Filtrez, archivez, ajustez vos préférences.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {unread.data?.unreadCount ?? 0} non lue
              {(unread.data?.unreadCount ?? 0) > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={handleRefreshCenter}
              disabled={refreshCenter.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  refreshCenter.isPending && "animate-spin",
                )}
              />
              Régénérer
            </button>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={markAll.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              <MailCheck className="h-4 w-4" />
              Tout marquer lu
            </button>
          </div>
        </div>
      </header>

      {/* Filtres */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">
              Recherche
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Titre de notification…"
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
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
            Actualiser
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setStatusFilter(f.key);
                  setPage(0);
                }}
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
          <div className="h-5 w-px bg-border" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setKindFilter("all");
                setPage(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                kindFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              Tous types
            </button>
            {(Object.keys(KIND_LABEL) as NotificationKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKindFilter(k);
                  setPage(0);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  kindFilter === k
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {KIND_ICON[k]}
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPriorityFilter("all");
                setPage(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                priorityFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              Toutes priorités
            </button>
            {(Object.keys(PRIORITY_LABEL) as NotificationPriority[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPriorityFilter(p);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    priorityFilter === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ),
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
              Réinitialiser
            </button>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Liste principale */}
        <section className="space-y-4">
          {isLoading && <LoadingState />}
          {!isLoading && items.length === 0 && <EmptyState />}
          {!isLoading && items.length > 0 && (
            <ul className="space-y-3">
              {items.map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onMarkRead={() => handleMarkRead(n)}
                  onMarkUnread={() => handleMarkUnread(n)}
                  onDismiss={() => handleDismiss(n)}
                  onDelete={() => handleDelete(n)}
                  busy={
                    markRead.isPending ||
                    markUnread.isPending ||
                    dismiss.isPending ||
                    deleteMutation.isPending
                  }
                />
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                Page {page + 1} / {totalPages} · {total} notification
                {total > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
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
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Rail droit — Digests */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Digests IA
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  Synthèses générées
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {digests.data?.length ?? 0}
              </span>
            </div>
            {digests.isLoading && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Chargement…
              </div>
            )}
            {!digests.isLoading && (!digests.data || digests.data.length === 0) && (
              <p className="mt-3 text-xs text-muted-foreground">
                Aucun digest pour l’instant. Les synthèses périodiques
                apparaîtront ici.
              </p>
            )}
            {!digests.isLoading && digests.data && digests.data.length > 0 && (
              <ul className="mt-3 space-y-3">
                {digests.data.slice(0, 10).map((d) => (
                  <li key={d.id} className="text-xs">
                    <div className="font-semibold text-foreground line-clamp-1">
                      {d.subject ?? `Digest #${d.id}`}
                    </div>
                    {d.summary && (
                      <div className="mt-0.5 text-muted-foreground line-clamp-2 leading-snug">
                        {d.summary}
                      </div>
                    )}
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                      <Sparkles className="h-2.5 w-2.5" />
                      {formatDateTime(d.createdAt)}
                      <span aria-hidden>·</span>
                      <span className="uppercase">{d.kind}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              <Bell className="h-3 w-3" />
              Routage intelligent
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Les alertes critiques sont poussées immédiatement (in-app + email),
              les signaux faibles sont regroupés dans le digest. Vous gardez la
              main depuis vos préférences.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function NotificationCard({
  notification: n,
  onMarkRead,
  onMarkUnread,
  onDismiss,
  onDelete,
  busy,
}: {
  readonly notification: Notification;
  readonly onMarkRead: () => void;
  readonly onMarkUnread: () => void;
  readonly onDismiss: () => void;
  readonly onDelete: () => void;
  readonly busy: boolean;
}) {
  const channels = parseNotificationChannels(n.channels);
  const isRead = n.status === "READ";
  const isDismissed = n.status === "DISMISSED";

  return (
    <li
      className={cn(
        "group rounded-2xl border bg-card px-4 py-3 shadow-sm transition hover:shadow-md",
        isRead ? "border-border/60 opacity-80" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            PRIORITY_TONE[n.priority],
          )}
        >
          {PRIORITY_LABEL[n.priority]}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                KIND_TONE[n.kind],
              )}
            >
              {KIND_ICON[n.kind]}
              {KIND_LABEL[n.kind] ?? n.kind}
            </span>
            <span aria-hidden>·</span>
            <span>{formatDateTime(n.createdAt)}</span>
            {channels.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>via {channels.join(", ")}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="lowercase">{STATUS_LABEL[n.status]}</span>
          </div>
          <div className="text-sm font-semibold text-foreground line-clamp-2">
            {n.title ?? `Notification #${n.id}`}
          </div>
          {(n.summary || n.body) && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {n.summary || n.body}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {n.ctaLabel && n.ctaUrl && (
              <a
                href={n.ctaUrl}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {n.ctaLabel}
                <ChevronRight className="h-3 w-3" />
              </a>
            )}
            {!isRead && (
              <button
                type="button"
                onClick={onMarkRead}
                disabled={busy}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <MailCheck className="h-3 w-3" />
                Marquer lu
              </button>
            )}
            {isRead && (
              <button
                type="button"
                onClick={onMarkUnread}
                disabled={busy}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Inbox className="h-3 w-3" />
                Marquer non lu
              </button>
            )}
            {!isDismissed && (
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-amber-600 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Ignorer
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement des notifications…
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">
        Aucune notification correspondante
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Tout est sous contrôle. Le copilote surveille en continu.
      </p>
    </div>
  );
}