import { useMemo, useState } from "react";
import {
  Brain,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  extractContentExcerpt,
  useCreateMemoryDocument,
  useDeleteMemoryDocument,
  useMemoryDocuments,
  type MemoryDocument,
} from "@/api/memory";

// MemoryHubPage — hub centralisé des documents mémoire (LOT migration Spring
// Boot). Backend : /api/memory-documents (CRUD JHipster). À la différence de la
// page Mémoire vivante (timeline d'événements), ici on se concentre sur la
// bibliothèque de documents mémoire : grille de cartes, création inline, delete.
// Les endpoints d'upload/analyse FastAPI (DocumentLibrary, extraction sémantique)
// ne sont pas migrés — on propose un CRUD direct.

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "expertise", label: "Expertise" },
  { value: "context", label: "Contexte" },
  { value: "preference", label: "Préférence" },
  { value: "other", label: "Autre" },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  KIND_OPTIONS.map((k) => [k.value, k.label]),
);

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  archived: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  draft: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
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

export default function MemoryHubPage() {
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentsQuery = useMemoryDocuments({
    kind: kindFilter || undefined,
    status: statusFilter || undefined,
    titleContains: appliedSearch.trim() || undefined,
  });
  const createMutation = useCreateMemoryDocument();
  const deleteMutation = useDeleteMemoryDocument();

  const documents = useMemo(
    () => documentsQuery.data ?? [],
    [documentsQuery.data],
  );

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Document mémoire supprimé.");
    } catch (e) {
      const message = extractBackendError(e);
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Brain className="h-3.5 w-3.5" />
          Memory Hub
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bibliothèque de mémoire IA
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Centralisez l'expertise, le contexte et les préférences que l'IA
          réutilise pour personnaliser les livrables. Chaque document indexé
          enrichit la mémoire du tenant — sans reposer les mêmes questions.
        </p>
      </header>

      {/* Barre de filtres + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Tous les types</option>
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="archived">Archivés</option>
          <option value="draft">Brouillons</option>
        </select>

        <form onSubmit={submitSearch} className="flex flex-1 min-w-[220px] gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre…"
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
          >
            Rechercher
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouveau
        </button>

        <button
          type="button"
          onClick={() => documentsQuery.refetch()}
          disabled={documentsQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              documentsQuery.isFetching && "animate-spin",
            )}
          />
        </button>
      </div>

      {showCreate && (
        <CreateDocumentCard
          creating={createMutation.isPending}
          onCreate={async (input) => {
            setError(null);
            try {
              await createMutation.mutateAsync(input);
              toast.success("Document mémoire créé.");
              setShowCreate(false);
            } catch (e) {
              const message = extractBackendError(e);
              setError(message);
              toast.error(message);
            }
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {documentsQuery.isLoading ? (
        <LoadingState label="Chargement des documents mémoire…" />
      ) : documentsQuery.isError ? (
        <ErrorState
          message={extractBackendError(documentsQuery.error)}
          onRetry={() => documentsQuery.refetch()}
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Aucun document mémoire"
          message="Ajoutez votre premier document (expertise, contexte, préférence) pour commencer à alimenter la mémoire IA."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDelete={handleDelete}
              deleting={
                deleteMutation.isPending && deleteMutation.variables === doc.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateDocumentCard({
  creating,
  onCreate,
  onCancel,
}: {
  creating: boolean;
  onCreate: (input: {
    kind: string;
    title: string;
    content: string;
    status: string;
  }) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState("expertise");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("active");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !kind.trim()) return;
    onCreate({ kind, title: title.trim(), content, status });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-foreground">
        Nouveau document mémoire
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Statut</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="active">Actif</option>
            <option value="draft">Brouillon</option>
            <option value="archived">Archivé</option>
          </select>
        </label>
      </div>

      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">Titre</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. Positionnement stratégique Q2"
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">Contenu</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Texte libre ou JSON structuré (ex. préférences, contexte métier)…"
          rows={4}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Créer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function DocumentCard({
  document,
  onDelete,
  deleting,
}: {
  document: MemoryDocument;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const excerpt = extractContentExcerpt(document.content, 240);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {kindLabel(document.kind)}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            STATUS_TONE[document.status] ?? "bg-muted text-muted-foreground",
          )}
        >
          {document.status}
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {formatDateTime(document.createdAt)}
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2">
          {document.title}
        </h3>
        {excerpt ? (
          <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
            {excerpt}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Document sans contenu.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">
          Mis à jour {formatDateTime(document.updatedAt)}
        </span>
        <button
          type="button"
          onClick={() => onDelete(document.id)}
          disabled={deleting}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Supprimer
        </button>
      </div>
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
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-500/10"
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