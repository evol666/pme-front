import { useRef, useState } from "react";
import {
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  useDocuments,
  useUploadDocumentDirect,
  useDeleteDocument,
  type RagDocument,
  type RagDocumentStatus,
} from "@/api/documents";
import { cn } from "@/lib/utils";

// DocumentsPage — base documentaire RAG : upload direct (multipart) vers le
// backend Spring Boot + liste CRUD + suppression. Le pipeline d'indexation est
// asynchrone (Kafka) : le statut passe PENDING → INDEXING → INDEXED (ou ERROR).
// Le polling par document est géré par useDocument ; ici on rafraîchit la liste
// via invalidate (onSuccess) + bouton manuel.

function StatusIcon({ status }: { status: RagDocumentStatus }) {
  if (status === "INDEXED")
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "ERROR") return <AlertCircle className="w-4 h-4 text-red-500" />;
  if (status === "INDEXING")
    return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

const STATUS_LABEL: Record<RagDocumentStatus, string> = {
  PENDING: "En attente",
  INDEXING: "Indexation",
  INDEXED: "Indexé",
  ERROR: "Erreur",
};

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function DocumentRow({
  doc,
  onDelete,
  deleting,
}: {
  doc: RagDocument;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  return (
    <li className="px-6 py-4 flex items-center gap-4 hover:bg-accent/30 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">
          {doc.title}
        </p>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-2">
          <StatusIcon status={doc.status} />
          {STATUS_LABEL[doc.status]}
          {doc.chunkCount > 0 && <span>· {doc.chunkCount} chunks</span>}
          <span>· {formatBytes(doc.sizeBytes)}</span>
          {doc.ingestedAt && (
            <span>
              · {new Date(doc.ingestedAt).toLocaleDateString("fr-FR")}
            </span>
          )}
        </p>
        {doc.status === "ERROR" && doc.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400 truncate">
            {doc.error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(doc.id)}
        disabled={deleting}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        title="Supprimer"
        aria-label="Supprimer le document"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

export default function DocumentsPage() {
  const { data, isLoading, isFetching, refetch } = useDocuments();
  const upload = useUploadDocumentDirect();
  const del = useDeleteDocument();

  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      await upload.mutateAsync({
        file,
        title: title.trim() || file.name,
        sourceKind: "manual",
      });
      setTitle("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      setUploadError(
        axiosErr?.response?.data?.error?.message ??
          "Échec de l'upload du document.",
      );
    }
  };

  const handleDelete = (id: number) => {
    del.mutate(id);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Base documentaire
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Documents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alimentez la base RAG utilisée par l'IA. L'indexation est asynchrone.
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

      {/* Upload */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          Ajouter un document
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label
              htmlFor="doc-title"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              Titre (optionnel)
            </label>
            <input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom affiché du document"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <input
            ref={fileInput}
            type="file"
            id="doc-file"
            onChange={handleFile}
            className="hidden"
            accept=".pdf,.txt,.md,.docx,.doc,.html,.csv"
          />
          <label
            htmlFor="doc-file"
            className={cn(
              "inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors cursor-pointer",
              upload.isPending && "opacity-50 pointer-events-none",
            )}
          >
            {upload.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Choisir un fichier
          </label>
        </div>
        {uploadError && (
          <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          PDF, TXT, Markdown, DOCX, HTML, CSV. Le document sera indexé après
          upload.
        </p>
      </div>

      {/* Liste */}
      <section className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Documents indexés
          </h2>
          <span className="text-xs text-muted-foreground">
            {data?.length ?? 0} document(s)
          </span>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucun document. Ajoutez-en un ci-dessus.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {data.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={handleDelete}
                deleting={del.isPending}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}