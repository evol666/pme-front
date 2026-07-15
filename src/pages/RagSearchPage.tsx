import { useState } from "react";
import { toast } from "sonner";
import {
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";

import {
  extractBackendError,
  parseRagJsonObject,
  useRagAsk,
  useRagDocuments,
  useRagSearch,
  useRagStats,
  type RagChunkView,
  type RagDocument,
  type RagDocumentStatus,
} from "@/api/rag";
import { cn } from "@/lib/utils";

// Page Recherche sémantique (RAG). Version Spring Boot.
// Route : /search
// - Barre de recherche → useRagSearch (POST /api/rag/search) : hits de chunks.
// - Section ask (optionnelle) → useRagAsk (POST /api/rag/ask) : réponse + citations.
// - Sidebar documents RAG (useRagDocuments) + stats (useRagStats).
// États loading / empty / error. Bouton désactivé pendant la mutation.

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

function formatScore(score: number | null | undefined): string {
  if (score == null) return "—";
  return `${(score * 100).toFixed(1)} %`;
}

const STATUS_STYLES: Record<RagDocumentStatus, string> = {
  INDEXED: "bg-emerald-500/10 text-emerald-600",
  INDEXING: "bg-sky-500/10 text-sky-600",
  PENDING: "bg-amber-500/10 text-amber-600",
  ERROR: "bg-red-500/10 text-red-600",
  DELETED: "bg-slate-500/10 text-slate-600",
};

// Hook regroupant l'état de la recherche (query, k, résultats) et les deux
// soumissions (recherche / ask). Extrait du composant pour que sa complexité
// cognitive propre reste faible et ne s'ajoute pas à celle de RagSearchPage.
function useRagSearchForm() {
  const [query, setQuery] = useState("");
  const [k, setK] = useState(8);
  const [results, setResults] = useState<RagChunkView[] | null>(null);

  const search = useRagSearch();
  const ask = useRagAsk();

  const submitSearch = (e: React.SubmitEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      toast.error("Saisis une requête de recherche.");
      return;
    }
    search.mutate(
      { query: q, k, source_kinds: [] },
      {
        onSuccess: (data) => setResults(data.items ?? []),
        onError: (err) => {
          setResults(null);
          toast.error(extractBackendError(err));
        },
      },
    );
  };

  const submitAsk = (e: React.SubmitEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      toast.error("Saisis une question.");
      return;
    }
    ask.mutate(
      { question: q, k, source_kinds: [] },
      {
        onError: (err) => toast.error(extractBackendError(err)),
      },
    );
  };

  return {
    query,
    setQuery,
    k,
    setK,
    results,
    setResults,
    search,
    ask,
    submitSearch,
    submitAsk,
  };
}

export default function RagSearchPage() {
  const [askOpen, setAskOpen] = useState(false);
  const {
    query,
    setQuery,
    k,
    setK,
    results,
    setResults,
    search,
    ask,
    submitSearch,
    submitAsk,
  } = useRagSearchForm();
  const docs = useRagDocuments({ limit: 100 });
  const stats = useRagStats();

  const documents = docs.data?.items ?? [];

  const searching = search.isPending;
  const asking = ask.isPending;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Search className="h-4 w-4" />
          Recherche sémantique
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Recherche IA dans vos documents
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Interroge la base vectorielle RAG (Qdrant) : récupère les extraits les
          plus pertinents ou demande une réponse générée avec citations
          vérifiables.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">
              Requête sémantique
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ex. stratégie pricing, churn, onboarding…"
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Top K</span>
            <input
              type="number"
              min={1}
              max={50}
              value={k}
              onChange={(e) => setK(Number(e.target.value) || 8)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-24"
            />
          </label>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Rechercher
          </button>
          <button
            type="button"
            onClick={() => setAskOpen((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Sparkles className="h-4 w-4" />
            {askOpen ? "Masquer Ask" : "Ask IA"}
          </button>
        </form>

        {askOpen && (
          <form
            onSubmit={submitAsk}
            className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-end"
          >
            <p className="flex-1 text-xs text-muted-foreground">
              Ask envoie la question au pipeline RAG (FastAPI) : génération
              d&apos;une réponse synthétique avec citations extraites des
              documents.
            </p>
            <button
              type="submit"
              disabled={asking || !query.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {asking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Générer une réponse
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <SearchResultsSection
            searching={searching}
            results={results}
            onClear={() => setResults(null)}
          />

          {ask.data && <AskAnswerCard answer={ask.data} asking={asking} />}
        </section>

        <aside className="space-y-4">
          <StatsCard
            stats={stats.data}
            isLoading={stats.isLoading}
            isFetching={stats.isFetching}
            onRefresh={() => stats.refetch()}
          />
          <DocumentsCard
            documents={documents}
            isLoading={docs.isLoading}
            isFetching={docs.isFetching}
            onRefresh={() => docs.refetch()}
          />
        </aside>
      </div>
    </div>
  );
}

// Bloc de résultats de recherche : état chargement / vide / liste. Extrait de
// RagSearchPage pour éviter la ternaire imbriquée et garder la complexité
// cognitive du composant principal sous le seuil autorisé.
function SearchResultsSection({
  searching,
  results,
  onClear,
}: {
  readonly searching: boolean;
  readonly results: RagChunkView[] | null;
  readonly onClear: () => void;
}) {
  if (searching) return <LoadingState label="Recherche sémantique en cours…" />;
  if (results === null) return <IdleState />;
  if (results.length === 0) return <EmptyState />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {results.length} extrait{results.length > 1 ? "s" : ""}{" "}
          pertinent{results.length > 1 ? "s" : ""}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Effacer
        </button>
      </div>
      <ul className="space-y-3">
        {results.map((hit, i) => (
          <ChunkHit key={`${hit.id ?? i}-${i}`} hit={hit} rank={i + 1} />
        ))}
      </ul>
    </div>
  );
}

// Couleur du score de pertinence — if/else plutôt que ternaires imbriquées.
function scoreToneClass(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 0.75) return "text-emerald-600";
  if (score >= 0.5) return "text-sky-600";
  return "text-amber-600";
}

function ChunkHit({ hit, rank }: { readonly hit: RagChunkView; readonly rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const score = hit.score;
  const scorePct = formatScore(score);
  const scoreTone = scoreToneClass(score);

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground tabular-nums">
            {rank}
          </span>
          <span className="font-mono">
            doc #{hit.document_id ?? "—"}
            {hit.section ? ` · ${hit.section}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {hit.tokens != null && (
            <span className="text-muted-foreground tabular-nums">
              {hit.tokens} tok
            </span>
          )}
          <span className={cn("font-semibold tabular-nums", scoreTone)}>
            {scorePct}
          </span>
        </div>
      </div>
      <p
        className={cn(
          "mt-3 text-sm text-foreground",
          !expanded && "line-clamp-3",
        )}
      >
        {hit.text ?? "—"}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-xs font-medium text-primary hover:underline"
      >
        {expanded ? "Réduire" : "Lire l'extrait complet"}
      </button>
    </li>
  );
}

function AskAnswerCard({
  answer,
  asking,
}: {
  readonly answer: NonNullable<ReturnType<typeof useRagAsk>["data"]>;
  readonly asking: boolean;
}) {
  const citations = answer.citations ?? [];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Réponse IA
          {answer.mock ? (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
              mock
            </span>
          ) : null}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {answer.elapsed_ms != null ? `${answer.elapsed_ms} ms` : "—"}
          {answer.model ? ` · ${answer.model}` : ""}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">
        {asking ? "Génération en cours…" : (answer.answer ?? "—")}
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded px-2 py-0.5 font-medium",
            answer.grounded
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-amber-500/10 text-amber-600",
          )}
        >
          {answer.grounded ? "grounded" : "non grounded"}
        </span>
      </div>
      {citations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Citations
          </p>
          <ul className="space-y-2">
            {citations.map((c, i) => (
              <li
                key={`${c.chunk_id ?? i}-${i}`}
                className="rounded-lg border border-border bg-background p-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-muted-foreground">
                    #{(c.index ?? i) + 1} · doc {c.document_id ?? "—"}
                    {c.source_kind ? ` · ${c.source_kind}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatScore(c.score)}
                  </span>
                </div>
                {c.title && (
                  <p className="mt-1 font-medium text-foreground">{c.title}</p>
                )}
                {c.excerpt && (
                  <p className="mt-1 line-clamp-3 text-muted-foreground">
                    {c.excerpt}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatsCard({
  stats,
  isLoading,
  isFetching,
  onRefresh,
}: {
  readonly stats: ReturnType<typeof useRagStats>["data"];
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly onRefresh: () => void;
}) {
  const byKind = stats?.by_source_kind ?? {};
  const kinds = Object.entries(byKind).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Database className="h-4 w-4 text-primary" />
          Stats RAG
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Rafraîchir les stats"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Documents</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">
              {stats?.documents_total ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Chunks</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">
              {stats?.chunks_total ?? 0}
            </dd>
          </div>
        </dl>
      )}
      {kinds.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Par source
          </p>
          <div className="flex flex-wrap gap-1.5">
            {kinds.map(([kind, count]) => (
              <span
                key={kind}
                className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums"
              >
                {kind} · {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsCard({
  documents,
  isLoading,
  isFetching,
  onRefresh,
}: {
  readonly documents: RagDocument[];
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          Documents ingérés
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Rafraîchir les documents"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </button>
      </div>
      {isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
      {!isLoading && documents.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucun document indexé pour ce tenant.
        </p>
      )}
      {!isLoading && documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { readonly doc: RagDocument }) {
  const [expanded, setExpanded] = useState(false);
  const attrs = parseRagJsonObject(doc.attributes);
  const tags = doc.tags
    ? doc.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const statusStyle =
    STATUS_STYLES[doc.status] ?? "bg-muted text-muted-foreground";
  return (
    <li className="rounded-lg border border-border bg-background p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-left"
        >
          <p className="font-medium text-foreground line-clamp-1">{doc.title}</p>
          <p className="mt-0.5 font-mono text-muted-foreground">
            #{doc.id} · {doc.sourceKind}
            {doc.language ? ` · ${doc.language}` : ""}
          </p>
        </button>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium",
            statusStyle,
          )}
        >
          {doc.status}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-muted-foreground tabular-nums">
        <span>{doc.chunkCount} chunks</span>
        {doc.sizeBytes != null && (
          <span>· {(doc.sizeBytes / 1024).toFixed(1)} Ko</span>
        )}
        <span>· {formatDateTime(doc.ingestedAt)}</span>
      </div>
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {expanded && (
        <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
          <Detail label="URI" value={doc.uri ?? "—"} />
          <Detail label="Source ID" value={doc.sourceId ?? "—"} />
          <Detail label="Indexed" value={formatDateTime(doc.indexedAt)} />
          <Detail label="Checksum" value={doc.checksum ?? "—"} />
        </dl>
      )}
      {expanded && doc.error && (
        <p className="mt-2 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-600">
          {doc.error}
        </p>
      )}
      {expanded && attrs && (
        <pre className="mt-2 overflow-x-auto rounded border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          {JSON.stringify(attrs, null, 2)}
        </pre>
      )}
    </li>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-foreground">{value}</dd>
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

function IdleState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">
        Lance une recherche sémantique
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Saisis une requête ci-dessus pour interroger la base vectorielle.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">Aucun extrait trouvé</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aucun chunk ne correspond à cette requête, ou la base RAG est vide.
      </p>
    </div>
  );
}