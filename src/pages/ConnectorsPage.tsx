import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Plug,
  RefreshCw,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  parseJsonObject,
  useConnectorSyncs,
  useConnectorWebhooks,
  useDeleteConnectorSync,
  useDeleteConnectorWebhook,
  type ConnectorSync,
  type ConnectorWebhook,
} from "@/api/connectors";
import { cn } from "@/lib/utils";

// Filtre tri-état pour le champ "traité" des webhooks : "" (tous), "true" ou "false".
type TristateFilter = "" | "true" | "false";

// Traduit un filtre "" | "true" | "false" en booléen optionnel pour l'API —
// if/else plutôt que ternaires imbriquées.
function tristateFilterToBoolean(filter: TristateFilter): boolean | undefined {
  if (filter === "true") return true;
  if (filter === "false") return false;
  return undefined;
}

// Page « Connecteurs » (LOT 15). Version Spring Boot : 2 onglets CRUD sur les entités
// spécifiques aux connecteurs — synchronisations (ConnectorSync) et webhooks reçus
// (ConnectorWebhook). La gestion des connexions OAuth (Connection) est déjà couverte
// par ReseauPage (onglet « Connexions »).
//
// ÉCARTS : l'ancien frontend FastAPI proposait aussi une marketplace de providers
// (/api/connectors/providers), un health overview agrégé (/api/connectors/health) et
// des actions OAuth (connect/disconnect/refresh/sync sur /api/connectors/...). Ces
// endpoints n'ont pas d'équivalent Spring Boot ; ils sont documentés comme FastAPI-only
// non migrés. La page se base sur le CRUD JHipster disponible.

type Tab = "syncs" | "webhooks";

const TABS: { key: Tab; label: string; icon: typeof Plug }[] = [
  { key: "syncs", label: "Synchronisations", icon: RefreshCw },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
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

// Tone générique pour un statut libre (ConnectorSync.status est un String, pas un enum).
// On examine la valeur de façon insensible à la casse pour rester défensif.
function syncStatusTone(status: string): { label: string; classes: string; dot: string } {
  const s = status.toUpperCase();
  if (s.includes("SUCCESS") || s.includes("OK") || s.includes("DONE")) {
    return {
      label: status,
      classes: "bg-emerald-500/10 text-emerald-600",
      dot: "bg-emerald-500",
    };
  }
  if (s.includes("RUN") || s.includes("PENDING") || s.includes("PROGRESS")) {
    return {
      label: status,
      classes: "bg-sky-500/10 text-sky-600",
      dot: "bg-sky-500 animate-pulse",
    };
  }
  if (s.includes("FAIL") || s.includes("ERROR")) {
    return {
      label: status,
      classes: "bg-red-500/10 text-red-600",
      dot: "bg-red-500",
    };
  }
  return {
    label: status,
    classes: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  };
}

export default function ConnectorsPage() {
  const [tab, setTab] = useState<Tab>("syncs");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Plug className="h-4 w-4" />
          Connecteurs entreprise
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Connecteurs</h1>
        <p className="max-w-2xl text-muted-foreground">
          Suivi des synchronisations de données vers vos providers externes et des webhooks
          reçus. Pour gérer les connexions OAuth elles-mêmes, consultez la page{" "}
          <span className="font-medium text-foreground">Réseau</span>.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "syncs" && <SyncsTab />}
      {tab === "webhooks" && <WebhooksTab />}
    </div>
  );
}

// --- Onglet Synchronisations ---

const SYNC_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "SUCCESS", label: "Réussis" },
  { key: "RUNNING", label: "En cours" },
  { key: "PENDING", label: "En attente" },
  { key: "FAILED", label: "Échecs" },
  { key: "ERROR", label: "Erreurs" },
];

function SyncsTab() {
  const [provider, setProvider] = useState("");
  const [entity, setEntity] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: syncs, isLoading, refetch, isFetching } = useConnectorSyncs(
    provider || undefined,
    entity || undefined,
    statusFilter || undefined,
  );
  const deleteMutation = useDeleteConnectorSync();

  const handleDelete = async (s: ConnectorSync) => {
    if (
      !globalThis.confirm(
        `Supprimer la synchronisation #${s.id} (${s.provider} · ${s.entity}) ?`,
      )
    )
      return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(s.id);
      toast.success("Synchronisation supprimée.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Provider</span>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="google, microsoft, hubspot…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Entité</span>
            <input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="messages, deals, files…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Actualiser
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SYNC_STATUS_FILTERS.map((f) => (
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

      {error && <ErrorBanner message={error} />}

      {isLoading && <LoadingState label="Chargement des synchronisations…" />}
      {!isLoading && (!syncs || syncs.length === 0) && (
        <EmptyState
          icon={RefreshCw}
          title="Aucune synchronisation"
          hint="Aucune sync de connecteur enregistrée. Les synchronisations apparaissent ici dès qu'un provider est invoqué."
        />
      )}
      {!isLoading && syncs && syncs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Entité</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Déclencheur</th>
                  <th className="px-4 py-3 font-medium tabular-nums">Items</th>
                  <th className="px-4 py-3 font-medium">Durée</th>
                  <th className="px-4 py-3 font-medium">Démarrée</th>
                  <th className="px-4 py-3 font-medium">Terminée</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {syncs.map((s) => {
                  const tone = syncStatusTone(s.status);
                  return (
                    <tr key={s.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{s.provider}</span>
                          {s.connection?.displayName && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {s.connection.displayName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.entity}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                            tone.classes,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                          {tone.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.trigger}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {s.itemsCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {formatDuration(s.durationMs)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(s.startedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(s.finishedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          aria-label={`Supprimer la synchronisation #${s.id}`}
                          disabled={
                            deleteMutation.isPending && deleteMutation.variables === s.id
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {deleteMutation.isPending &&
                          deleteMutation.variables === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Onglet Webhooks ---

const WEBHOOK_FILTERS: { key: TristateFilter; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "true", label: "Traités" },
  { key: "false", label: "En attente" },
];

function WebhooksTab() {
  const [provider, setProvider] = useState("");
  const [processedFilter, setProcessedFilter] = useState<TristateFilter>("");
  const [error, setError] = useState<string | null>(null);

  const processed = tristateFilterToBoolean(processedFilter);

  const { data: webhooks, isLoading, refetch, isFetching } = useConnectorWebhooks(
    provider || undefined,
    processed,
  );
  const deleteMutation = useDeleteConnectorWebhook();

  const handleDelete = async (w: ConnectorWebhook) => {
    if (
      !globalThis.confirm(
        `Supprimer le webhook #${w.id} (${w.provider} · ${w.eventType}) ?`,
      )
    )
      return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(w.id);
      toast.success("Webhook supprimé.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Provider</span>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="google, microsoft, hubspot…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Actualiser
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {WEBHOOK_FILTERS.map((f) => (
            <button
              key={f.key || "all"}
              type="button"
              onClick={() => setProcessedFilter(f.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                processedFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoading && <LoadingState label="Chargement des webhooks…" />}
      {!isLoading && (!webhooks || webhooks.length === 0) && (
        <EmptyState
          icon={Webhook}
          title="Aucun webhook"
          hint="Aucun webhook reçu de vos providers. Les événements entrants apparaîtront ici."
        />
      )}
      {!isLoading && webhooks && webhooks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {webhooks.map((w) => (
            <WebhookCard
              key={w.id}
              webhook={w}
              onDelete={() => handleDelete(w)}
              deleting={
                deleteMutation.isPending && deleteMutation.variables === w.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WebhookCard({
  webhook,
  onDelete,
  deleting,
}: {
  readonly webhook: ConnectorWebhook;
  readonly onDelete: () => void;
  readonly deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const payload = useMemo(
    () => parseJsonObject(webhook.payload),
    [webhook.payload],
  );
  const payloadEntries = useMemo(
    () => (payload ? Object.entries(payload).slice(0, 8) : []),
    [payload],
  );

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Webhook className="h-3 w-3" />
            {webhook.provider}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              webhook.processed
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                webhook.processed ? "bg-emerald-500" : "bg-amber-500 animate-pulse",
              )}
            />
            {webhook.processed ? "Traité" : "En attente"}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Supprimer le webhook #${webhook.id}`}
          disabled={deleting}
          className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </header>

      <h3 className="text-base font-semibold text-foreground">{webhook.eventType}</h3>

      <dl className="space-y-1 text-xs text-muted-foreground">
        {webhook.externalId && (
          <div className="flex justify-between gap-2">
            <dt>ID externe</dt>
            <dd className="truncate text-right font-mono text-foreground">
              {webhook.externalId}
            </dd>
          </div>
        )}
        {webhook.connection && (
          <div className="flex justify-between gap-2">
            <dt>Connexion</dt>
            <dd className="truncate text-right text-foreground">
              {webhook.connection.provider}
              {webhook.connection.displayName
                ? ` · ${webhook.connection.displayName}`
                : ""}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt>Reçu le</dt>
          <dd className="text-right text-foreground">
            {formatDateTime(webhook.receivedAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Traité le</dt>
          <dd className="text-right text-foreground">
            {formatDateTime(webhook.processedAt)}
          </dd>
        </div>
      </dl>

      {webhook.error && (
        <p className="inline-flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-3">{webhook.error}</span>
        </p>
      )}

      {payload && payloadEntries.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Zap className="h-3.5 w-3.5 text-primary" />
            {expanded ? "Masquer le payload" : "Voir le payload"}
          </button>
          {expanded && (
            <dl className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs">
              {payloadEntries.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate text-right font-mono text-foreground">
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </article>
  );
}

// --- États partagés ---

function ErrorBanner({ message }: { readonly message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

function LoadingState({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  readonly icon: typeof Plug;
  readonly title: string;
  readonly hint: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}