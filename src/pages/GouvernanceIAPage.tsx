import { useMemo, useState } from "react";
import {
  FileSearch,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Coins,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  aggregateCostsByProvider,
  parseGouvernanceJsonObject,
  useAiAuditEntries,
  useAiCosts,
  useAiTraces,
  type AiAuditEntry,
  type AiAuditEntryFilters,
  type AiCost,
  type AiCostFilters,
  type AiTrace,
  type AiTraceFilters,
} from "@/api/gouvernance";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// GouvernanceIAPage — route /gouvernance-ia. Réservée ROLE_ADMIN.
// 3 onglets : Audit (AiAuditEntryResource /api/ai-audit-entries paginé, filtres Criteria) ·
// Traces (AiTraceResource /api/ai-traces paginé) · Coûts (AiCostResource /api/ai-costs paginé,
// somme/coût par provider agrégée côté client).

type TabKey = "audit" | "traces" | "costs";

const TABS: { key: TabKey; label: string; icon: typeof ScrollText }[] = [
  { key: "audit", label: "Audit trail", icon: ScrollText },
  { key: "traces", label: "Traces IA", icon: FileSearch },
  { key: "costs", label: "Coûts IA", icon: Coins },
];

const PAGE_SIZE = 20;

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" });
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

export default function GouvernanceIAPage() {
  const roles = useAppSelector((s) => s.auth.roles);
  const isAdmin = roles.includes("ROLE_ADMIN");
  const [tab, setTab] = useState<TabKey>("audit");

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Accès refusé</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Cette section est réservée aux administrateurs. Votre compte n'a pas le rôle{" "}
          <code className="rounded bg-accent px-1.5 py-0.5 font-mono text-foreground">
            ROLE_ADMIN
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldAlert className="h-4 w-4" />
          Gouvernance IA
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Gouvernance & conformité IA
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Journal d'audit, traces d'appels IA et coûts agrégés par provider. Données issues
          du backend Spring Boot (JHipster). Réservé aux administrateurs.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
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
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "audit" && <AuditTab />}
      {tab === "traces" && <TracesTab />}
      {tab === "costs" && <CostsTab />}
    </div>
  );
}

// --- Audit trail ---

const AUDIT_KIND_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "ai_call", label: "AI call" },
  { key: "rag", label: "RAG" },
  { key: "agent", label: "Agent" },
  { key: "moderation", label: "Modération" },
  { key: "workflow", label: "Workflow" },
];

function AuditTab() {
  const [kind, setKind] = useState("");
  const [actor, setActor] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(0);

  const filters: AiAuditEntryFilters = useMemo(
    () => ({
      kind: kind || undefined,
      actorContains: actor.trim() || undefined,
      subjectContains: subject.trim() || undefined,
      page,
      size: PAGE_SIZE,
      sort: "createdAt,desc",
    }),
    [kind, actor, subject, page],
  );

  const { data, isLoading, isFetching, error, refetch } = useAiAuditEntries(filters);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Type :</span>
          {AUDIT_KIND_FILTERS.map((f) => (
            <FilterChip
              key={f.key || "all-kind"}
              active={kind === f.key}
              label={f.label}
              onClick={() => {
                setKind(f.key);
                setPage(0);
              }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Acteur contient</span>
            <input
              type="text"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="ex. system, copilot…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Sujet contient</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="ex. tenant-1, analysis…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(0)}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Filtrer
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={extractBackendError(error)} />}

      {isLoading ? (
        <LoadingState label="Chargement du journal d'audit…" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Aucune entrée d'audit"
          hint="Aucun événement ne correspond aux filtres."
        />
      ) : (
        <div className="space-y-3">
          <AuditTable items={data.items} />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function AuditTable({ items }: { items: AiAuditEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Acteur</th>
            <th className="px-4 py-3">Sujet</th>
            <th className="px-4 py-3">Résumé</th>
            <th className="px-4 py-3">Créé</th>
            <th className="px-4 py-3">Tenant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((a) => {
            const payload = parseGouvernanceJsonObject(a.payload);
            return (
              <tr key={a.id} className="hover:bg-accent/40">
                <td className="px-4 py-3">
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                    {a.kind}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {a.actor ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {a.subject ?? "—"}
                </td>
                <td className="max-w-xs px-4 py-3 text-muted-foreground line-clamp-2">
                  {a.summary ?? (payload ? JSON.stringify(payload).slice(0, 120) : "—")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(a.createdAt)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  #{a.tenant.id}
                  {a.tenant.name ? ` · ${a.tenant.name}` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Traces IA ---

const TRACE_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "ok", label: "OK" },
  { key: "error", label: "Erreur" },
  { key: "fallback", label: "Fallback" },
];

function TracesTab() {
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [operation, setOperation] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  const filters: AiTraceFilters = useMemo(
    () => ({
      provider: provider.trim() || undefined,
      model: model.trim() || undefined,
      operation: operation.trim() || undefined,
      status: status || undefined,
      page,
      size: PAGE_SIZE,
      sort: "createdAt,desc",
    }),
    [provider, model, operation, status, page],
  );

  const { data, isLoading, isFetching, error, refetch } = useAiTraces(filters);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Statut :</span>
          {TRACE_STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.key || "all-st"}
              active={status === f.key}
              label={f.label}
              onClick={() => {
                setStatus(f.key);
                setPage(0);
              }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Provider</span>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="ollama, openai…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Modèle</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="ex. llama3.2…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Opération</span>
            <input
              type="text"
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              placeholder="chat, rag, agent…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setPage(0);
              refetch();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Actualiser
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={extractBackendError(error)} />}

      {isLoading ? (
        <LoadingState label="Chargement des traces IA…" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Aucune trace"
          hint="Aucun appel IA enregistré ne correspond aux filtres."
        />
      ) : (
        <div className="space-y-3">
          <TracesTable items={data.items} />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function TracesTable({ items }: { items: AiTrace[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Modèle</th>
            <th className="px-4 py-3">Opération</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3 text-right">Tokens in</th>
            <th className="px-4 py-3 text-right">Tokens out</th>
            <th className="px-4 py-3 text-right">Latence</th>
            <th className="px-4 py-3 text-right">Coût USD</th>
            <th className="px-4 py-3 text-center">Fallback</th>
            <th className="px-4 py-3">Créé</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((t) => {
            const statusTone =
              t.status === "ok"
                ? "bg-emerald-500/10 text-emerald-600"
                : t.status === "error" || t.status === "failed"
                  ? "bg-red-500/10 text-red-600"
                  : t.status === "fallback"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-muted text-muted-foreground";
            return (
              <tr key={t.id} className="hover:bg-accent/40">
                <td className="px-4 py-3 font-medium text-foreground">{t.provider}</td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">{t.model}</td>
                <td className="px-4 py-3 text-foreground">{t.operation}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusTone)}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {t.tokensIn.toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {t.tokensOut.toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {t.latencyMs != null ? `${t.latencyMs} ms` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {t.costUsd.toFixed(6)}
                </td>
                <td className="px-4 py-3 text-center">
                  {t.fallbackUsed ? (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                      oui
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">non</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(t.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Coûts IA ---

function CostsTab() {
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(0);

  const filters: AiCostFilters = useMemo(
    () => ({
      provider: provider.trim() || undefined,
      model: model.trim() || undefined,
      day: day || undefined,
      page,
      size: PAGE_SIZE,
      sort: "day,desc",
    }),
    [provider, model, day, page],
  );

  const { data, isLoading, isFetching, error, refetch } = useAiCosts(filters);

  const aggregated = useMemo(
    () => (data ? aggregateCostsByProvider(data.items) : []),
    [data],
  );

  const totalCostUsd = useMemo(
    () => aggregated.reduce((sum, c) => sum + c.costUsd, 0),
    [aggregated],
  );

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const copyCost = () => {
    if (totalCostUsd <= 0) return;
    toast.success(`Coût total page courante : ${totalCostUsd.toFixed(4)} USD`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Provider</span>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="ollama, openai…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Modèle</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="ex. llama3.2…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Jour</span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-44"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setPage(0);
              refetch();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Actualiser
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={extractBackendError(error)} />}

      {isLoading ? (
        <LoadingState label="Chargement des coûts IA…" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="Aucun coût enregistré"
          hint="Aucun rollup coût ne correspond aux filtres."
        />
      ) : (
        <div className="space-y-4">
          {/* Résumé agrégé par provider */}
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Synthèse par provider (page courante)
              </h2>
              <button
                type="button"
                onClick={copyCost}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                <Coins className="h-3.5 w-3.5" />
                {totalCostUsd.toFixed(4)} USD
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {aggregated.map((c) => (
                <div
                  key={c.provider}
                  className="space-y-1 rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {c.provider}
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-foreground">
                      {c.costUsd.toFixed(4)} USD
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    <div>
                      <dt>Appels</dt>
                      <dd className="tabular-nums text-foreground">
                        {c.calls.toLocaleString("fr-FR")}
                      </dd>
                    </div>
                    <div>
                      <dt>Tokens in</dt>
                      <dd className="tabular-nums text-foreground">
                        {c.tokensIn.toLocaleString("fr-FR")}
                      </dd>
                    </div>
                    <div>
                      <dt>Tokens out</dt>
                      <dd className="tabular-nums text-foreground">
                        {c.tokensOut.toLocaleString("fr-FR")}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </section>

          {/* Table détaillée des rollups */}
          <CostsTable items={data.items} />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function CostsTable({ items }: { items: AiCost[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Jour</th>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Modèle</th>
            <th className="px-4 py-3 text-right">Appels</th>
            <th className="px-4 py-3 text-right">Tokens in</th>
            <th className="px-4 py-3 text-right">Tokens out</th>
            <th className="px-4 py-3 text-right">Coût USD</th>
            <th className="px-4 py-3">Tenant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((c) => (
            <tr key={c.id} className="hover:bg-accent/40">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {formatDate(c.day)}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">{c.provider}</td>
              <td className="px-4 py-3 font-mono text-xs text-foreground">{c.model}</td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                {c.calls.toLocaleString("fr-FR")}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                {c.tokensIn.toLocaleString("fr-FR")}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                {c.tokensOut.toLocaleString("fr-FR")}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                {c.costUsd.toFixed(6)}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                #{c.tenant.id}
                {c.tenant.name ? ` · ${c.tenant.name}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Composants partagés ---

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

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString("fr-FR")} entrée{total > 1 ? "s" : ""} · affichage {from}-{to}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Précédent
        </button>
        <span className="tabular-nums px-2 text-xs text-muted-foreground">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          Suivant
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
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
  icon: typeof ScrollText;
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