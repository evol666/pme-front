import { useMemo, useState } from "react";
import {
  Check,
  Eye,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  incidentStatus,
  parseIncidentMetadata,
  useDeleteModerationIncident,
  useModerationIncidents,
  usePatchModerationIncident,
  type AlertSeverity,
  type IncidentAction,
  type ModerationIncident,
} from "@/api/securite";
import { cn } from "@/lib/utils";

// Sécurité & modération IA (LOT modération IA). Version Spring Boot.
// Liste les incidents de modération (ModerationIncidentResource /api/moderation-incidents)
// avec filtres severity / direction / statut d'action / catégorie, compteurs dérivés,
// et actions : marquer vu, résoudre, écarter (PATCH actionTaken), supprimer (DELETE).
//
// Écarts vs UX source (React 18/FastAPI) :
// - Pas d'endpoint stats Spring Boot (FastAPI-only) → compteurs dérivés côté front sur
//   la page chargée (200 plus récents).
// - Pas d'export CSV Spring Boot (FastAPI-only) → bouton omis.
// - Le DTO réel n'expose pas status/resolvedAt → le statut d'incident est porté par
//   `actionTaken` (string ≤ 24). Les actions PATCH positionnent actionTaken à
//   seen|resolved|dismissed.

const SEVERITY_TONE: Record<AlertSeverity, string> = {
  CRITICAL: "bg-red-500/10 text-red-600",
  HIGH: "bg-orange-500/10 text-orange-600",
  MEDIUM: "bg-amber-500/10 text-amber-600",
  LOW: "bg-sky-500/10 text-sky-600",
  INFO: "bg-slate-500/10 text-slate-600",
};

const SEVERITY_FILTERS: { key: AlertSeverity | ""; label: string }[] = [
  { key: "", label: "Toutes" },
  { key: "CRITICAL", label: "Critiques" },
  { key: "HIGH", label: "Hautes" },
  { key: "MEDIUM", label: "Moyennes" },
  { key: "LOW", label: "Basses" },
  { key: "INFO", label: "Info" },
];

const DIRECTION_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Toutes" },
  { key: "input", label: "Entrées" },
  { key: "output", label: "Sorties" },
];

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "new", label: "Nouveaux" },
  { key: "seen", label: "Vus" },
  { key: "resolved", label: "Résolus" },
  { key: "dismissed", label: "Écartés" },
];

const STATUS_TONE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  seen: "bg-sky-500/10 text-sky-600",
  resolved: "bg-emerald-500/10 text-emerald-600",
  dismissed: "bg-slate-500/10 text-slate-600",
  blocked: "bg-red-500/10 text-red-600",
  warning: "bg-amber-500/10 text-amber-600",
  allowed: "bg-emerald-500/10 text-emerald-600",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  seen: "Vu",
  resolved: "Résolu",
  dismissed: "Écarté",
  blocked: "Bloqué",
  warning: "Avertissement",
  allowed: "Autorisé",
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

export default function SecuritePage() {
  const [severity, setSeverity] = useState<AlertSeverity | "">("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  const filters = useMemo(
    () => ({
      severity: severity || undefined,
      direction: direction || undefined,
      actionTaken: status || undefined,
      category: category.trim() || undefined,
    }),
    [severity, direction, status, category],
  );

  const { data, isLoading, isFetching, refetch, error } =
    useModerationIncidents(filters);
  const incidents = data ?? [];

  const counts = useMemo(() => {
    const bySeverity: Record<AlertSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };
    for (const inc of incidents) {
      bySeverity[inc.severity] = (bySeverity[inc.severity] ?? 0) + 1;
    }
    return { total: incidents.length, bySeverity };
  }, [incidents]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldAlert className="h-4 w-4" />
          Sécurité
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Sécurité & modération IA
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Surveillez les incidents détectés sur les flux IA — entrées (injection, PII,
          secrets) et sorties (fuite, hallucination, contenu dangereux). Données issues
          du backend Spring Boot.
        </p>
      </header>

      {error ? <ErrorBanner message={extractBackendError(error)} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Incidents (page courante)"
          value={counts.total}
          tone="bg-accent text-accent-foreground"
        />
        <StatTile
          label="Critiques"
          value={counts.bySeverity.CRITICAL}
          tone="bg-red-500/10 text-red-600"
        />
        <StatTile
          label="Hautes"
          value={counts.bySeverity.HIGH}
          tone="bg-orange-500/10 text-orange-600"
        />
        <StatTile
          label="Moyennes"
          value={counts.bySeverity.MEDIUM}
          tone="bg-amber-500/10 text-amber-600"
        />
      </section>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Sévérité :</span>
          {SEVERITY_FILTERS.map((f) => (
            <FilterChip
              key={`sev-${f.key || "all"}`}
              active={severity === f.key}
              label={f.label}
              onClick={() => setSeverity(f.key)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Direction :</span>
          {DIRECTION_FILTERS.map((f) => (
            <FilterChip
              key={`dir-${f.key || "all"}`}
              active={direction === f.key}
              label={f.label}
              onClick={() => setDirection(f.key)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Statut :</span>
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={`st-${f.key || "all"}`}
              active={status === f.key}
              label={f.label}
              onClick={() => setStatus(f.key)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Catégorie</span>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="ex. prompt_injection, pii_leak, secret_leak…"
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
      </div>

      {isLoading ? (
        <LoadingState label="Chargement des incidents…" />
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="Aucun incident"
          hint="Aucun incident ne correspond aux filtres, ou aucun flux IA n’a été marqué. Vos flux sont propres."
        />
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Carte incident ---

function IncidentCard({ incident }: { incident: ModerationIncident }) {
  const patchMutation = usePatchModerationIncident();
  const deleteMutation = useDeleteModerationIncident();
  const status = incidentStatus(incident.actionTaken);
  const statusLabel = STATUS_LABEL[status] ?? incident.actionTaken ?? "Nouveau";
  const statusToneClass = STATUS_TONE[status] ?? STATUS_TONE.new;
  const metadata = parseIncidentMetadata(incident.metadataJson);
  const busy = patchMutation.isPending && patchMutation.variables?.id === incident.id;
  const deleting =
    deleteMutation.isPending && deleteMutation.variables === incident.id;

  const patch = async (action: IncidentAction) => {
    try {
      await patchMutation.mutateAsync({ id: incident.id, actionTaken: action });
      toast.success(`Incident #${incident.id} — ${STATUS_LABEL[action] ?? action}.`);
    } catch (err) {
      toast.error(extractBackendError(err));
    }
  };

  const remove = async () => {
    try {
      await deleteMutation.mutateAsync(incident.id);
      toast.success(`Incident #${incident.id} supprimé.`);
    } catch (err) {
      toast.error(extractBackendError(err));
    }
  };

  const resolved = status === "resolved";
  const dismissed = status === "dismissed";

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3",
        dismissed && "opacity-70",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                SEVERITY_TONE[incident.severity],
              )}
            >
              {incident.severity}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                statusToneClass,
              )}
            >
              {statusLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              {incident.direction === "input"
                ? "Entrée"
                : incident.direction === "output"
                  ? "Sortie"
                  : (incident.direction ?? "—")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              {incident.category}
            </span>
            <span className="text-xs text-muted-foreground">#{incident.id}</span>
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {incident.ruleId ? incident.ruleId : incident.category}
          </h3>
          {incident.excerptRedacted ? (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {incident.excerptRedacted}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton
            icon={Eye}
            label="Marquer vu"
            onClick={() => patch("seen")}
            disabled={busy || deleting || status === "seen" || resolved || dismissed}
          />
          <ActionButton
            icon={Check}
            label="Résoudre"
            onClick={() => patch("resolved")}
            disabled={busy || deleting || resolved || dismissed}
            tone="primary"
          />
          <ActionButton
            icon={X}
            label="Écarter"
            onClick={() => patch("dismissed")}
            disabled={busy || deleting || dismissed}
            tone="destructive"
          />
          <ActionButton
            icon={Trash2}
            label="Supprimer"
            onClick={remove}
            disabled={busy || deleting}
            tone="destructive"
          />
        </div>
      </header>

      {incident.matchedPattern ? (
        <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
          <span className="font-medium">Motif détecté : </span>
          <span className="font-mono text-xs">{incident.matchedPattern}</span>
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        <Field label="Source" value={incident.source ?? "—"} />
        <Field label="Request ID" value={incident.requestId ?? "—"} />
        <Field label="Créé le" value={formatDateTime(incident.createdAt)} />
        <Field
          label="Utilisateur"
          value={incident.user?.login ?? incident.user?.email ?? "—"}
        />
      </dl>

      {metadata ? (
        <details className="rounded-lg border border-border bg-background">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
            Métadonnées
          </summary>
          <pre className="overflow-x-auto px-3 pb-3 text-xs text-muted-foreground">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </article>
  );
}

// --- Composants UI ---

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 inline-flex items-center gap-1 text-2xl font-semibold", tone)}>
        {value.toLocaleString("fr-FR")}
      </p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "primary" | "destructive";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
      : tone === "destructive"
        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
        : "border-border text-foreground hover:bg-accent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
        cls,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{value}</dd>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
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
  icon: typeof ShieldAlert;
  title: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}