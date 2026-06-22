import { useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAuditLogs,
  useDeleteAuditLog,
  type AuditLog,
} from "@/api/audit";
import { cn } from "@/lib/utils";

// ActivityLogPage — journal d'audit (AuditLogResource /api/audit-logs).
// Liste paginée (sort createdAt,desc) avec filtres action / resourceKind / statut.
// Détail @Lob expansible (JSON parsé défensivement). DELETE disponible pour
// nettoyage unitaire. L'ancien front (v2) exposait aussi export CSV/Excel/JSON
// et rétention RGPD : non supportés par le backend Spring Boot actuel, donc
// non migrés (voir écart en bas de fichier).

// --- Constantes d'affichage ---

// Les valeurs proviennent du backend (enums/strings libres côté DTO). On définit
// une palette de badges pour les valeurs courantes; tout autre valeur retombe
// sur un badge neutre.
const ACTION_TONE: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  update: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400",
  login: "bg-primary/10 text-primary",
  logout: "bg-accent text-muted-foreground",
  import: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  export: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  run: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  notify: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

const STATUS_TONE: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failure: "bg-red-500/10 text-red-600 dark:text-red-400",
  error: "bg-red-500/10 text-red-600 dark:text-red-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  running: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const ACTION_LABEL: Record<string, string> = {
  create: "Création",
  update: "Mise à jour",
  delete: "Suppression",
  login: "Connexion",
  logout: "Déconnexion",
  import: "Import",
  export: "Export",
  run: "Exécution",
  notify: "Notification",
};

const STATUS_LABEL: Record<string, string> = {
  success: "Succès",
  ok: "Succès",
  done: "Terminé",
  failure: "Échec",
  error: "Erreur",
  pending: "En attente",
  running: "En cours",
};

// Filtres prédéfinis (actions courantes). "Tous" = sans filtre.
const ACTION_FILTERS = [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "run",
] as const;

const STATUS_FILTERS = ["success", "failure", "pending", "running"] as const;

// --- Utilitaires ---

function actionTone(action: string): string {
  return ACTION_TONE[action] ?? "bg-accent text-muted-foreground";
}

function statusTone(status: string): string {
  return (
    STATUS_TONE[status] ??
    "bg-slate-500/10 text-slate-600 dark:text-slate-400"
  );
}

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
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

function userLabel(log: AuditLog): string {
  const u = log.user;
  if (!u) return "—";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return u.email ?? u.login ?? `Utilisateur #${u.id}`;
}

// Parse défensivement le champ @Lob `details` (string JSON ou texte libre).
function parseDetails(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw; // texte libre, on l'affiche tel quel
  }
}

function detailsToLines(
  details: unknown,
): Array<{ key: string; value: string }> {
  if (details == null) return [];
  if (typeof details === "string") {
    return [{ key: "Détails", value: details }];
  }
  if (Array.isArray(details)) {
    return [{ key: "Valeurs", value: JSON.stringify(details, null, 2) }];
  }
  if (typeof details === "object") {
    return Object.entries(details as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => ({
        key: k,
        value: typeof v === "object" ? JSON.stringify(v, null, 2) : String(v),
      }));
  }
  return [{ key: "Détails", value: String(details) }];
}

function extractBackendError(err: unknown): string {
  const e = err as {
    response?: { data?: { error?: { message?: string } }; statusText?: string };
  };
  return (
    e?.response?.data?.error?.message ??
    e?.response?.statusText ??
    "Une erreur est survenue. Réessayez."
  );
}

// --- Ligne d'événement ---

function EventRow({
  log,
  onDelete,
  pending,
}: {
  log: AuditLog;
  onDelete: (id: number) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const details = useMemo(() => parseDetails(log.details), [log.details]);
  const lines = useMemo(() => detailsToLines(details), [details]);
  const hasDetails = lines.length > 0;

  return (
    <li className="relative pl-8 pb-6">
      {/* Ligne de timeline */}
      <span className="absolute left-[7px] top-1.5 bottom-0 w-px bg-border/60" />
      <span
        className={cn(
          "absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full ring-4 ring-background",
          actionTone(log.action),
        )}
      />
      <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                  actionTone(log.action),
                )}
              >
                {actionLabel(log.action)}
              </span>
              {log.status && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    statusTone(log.status),
                  )}
                >
                  {statusLabel(log.status)}
                </span>
              )}
              {log.resourceKind && (
                <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {log.resourceKind}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {formatDateTime(log.createdAt)}
              </span>
            </div>
            <h3 className="mt-1.5 text-sm font-bold text-foreground">
              {actionLabel(log.action)}
              {log.resourceKind ? ` · ${log.resourceKind}` : ""}
              {log.resourceId ? ` · ${log.resourceId}` : ""}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {userLabel(log)}
              {log.ipAddress ? ` · ${log.ipAddress}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(log.id)}
            disabled={pending}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 shrink-0"
            title="Supprimer"
            aria-label="Supprimer cet événement"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {hasDetails && (
          <>
            <dl className={cn("mt-3 grid gap-1.5", !open && "line-clamp-3")}>
              {lines.map((line, idx) => (
                <div
                  key={`${line.key}-${idx}`}
                  className="flex items-start gap-2 text-xs"
                >
                  <dt className="font-semibold text-muted-foreground shrink-0">
                    {line.key}
                  </dt>
                  <dd className="text-foreground whitespace-pre-wrap break-all tabular-nums">
                    {line.value}
                  </dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1.5 text-[11px] font-bold text-primary hover:underline"
            >
              {open ? "Réduire" : "Voir plus"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// --- Page ---

const PAGE_SIZE = 25;

export default function ActivityLogPage() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [resourceKind, setResourceKind] = useState<string>("");
  const [status, setStatus] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching, refetch, error } = useAuditLogs({
    page,
    size: PAGE_SIZE,
    action,
    resourceKind: resourceKind.trim() || undefined,
    status,
  });
  const del = useDeleteAuditLog();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDelete = (id: number) => {
    del.mutate(id, {
      onSuccess: () => toast.success("Événement supprimé."),
      onError: (err) => toast.error(extractBackendError(err)),
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Traçabilité
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1 flex items-center gap-3">
            <Activity className="w-7 h-7 text-primary" />
            Journal d&apos;activité
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Qui a fait quoi, quand, avec quel résultat ({total} événement
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

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{extractBackendError(error)}</span>
        </div>
      ) : null}

      {/* Filtres */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setAction(undefined);
              setPage(0);
            }}
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
              !action
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            Toutes actions
          </button>
          {ACTION_FILTERS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAction(a);
                setPage(0);
              }}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                action === a
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {actionLabel(a)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setStatus(undefined);
              setPage(0);
            }}
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
              !status
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            Tous statuts
          </button>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(0);
              }}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>

        {/* Filtre libre resourceKind (resourceKind.equals). */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={resourceKind}
            onChange={(e) => {
              setResourceKind(e.target.value);
              setPage(0);
            }}
            placeholder="Filtrer par type de ressource (ex: document, analysis…)"
            className="h-9 w-full max-w-md rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucun événement
            {action ? ` d&apos;action « ${actionLabel(action)} »` : ""}
            {status ? ` de statut « ${statusLabel(status)} »` : ""}
            {resourceKind.trim() ? ` sur « ${resourceKind.trim()} »` : ""} pour
            le moment.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-2">
            {items.map((log) => (
              <EventRow
                key={log.id}
                log={log}
                onDelete={handleDelete}
                pending={del.isPending}
              />
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-muted-foreground tabular-nums">
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