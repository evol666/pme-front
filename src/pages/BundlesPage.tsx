import { useMemo, useState } from "react";
import {
  Briefcase,
  Eye,
  EyeOff,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";

import {
  parseBundleManifest,
  useBundles,
  useDeleteBundle,
  useToggleBundle,
  type StudioBundle,
} from "@/api/bundles";
import { cn } from "@/lib/utils";

// Catalogue des bundles métier (LOT "Studio"). Version Spring Boot : liste le CRUD
// `/api/studio-bundles` et reconstruit la vue catalogue côté client (l'endpoint
// `/api/bundles/catalog` FastAPI n'est pas migré). Filtre par nom + statut d'activation,
// toggle d'activation via PATCH, suppression, détail expansible du manifest.

const ASSET_KIND_LABEL: Record<string, string> = {
  prompt: "Prompts",
  workflow: "Workflows",
  template: "Templates",
  dashboard: "Dashboards",
  module: "Modules",
  rule: "Règles IA",
  embedding: "Embeddings",
};

type StatusFilter = "all" | "active" | "inactive";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "inactive", label: "Inactifs" },
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

export default function BundlesPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const isActiveParam =
    statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined;

  const { data: bundles, isLoading, refetch, isFetching } = useBundles(
    appliedSearch || undefined,
    isActiveParam,
  );
  const toggleMutation = useToggleBundle();
  const deleteMutation = useDeleteBundle();

  const filtered = useMemo(() => {
    if (!bundles) return [];
    // Filtre primaire (name.contains + isActive.equals) appliqué côté backend.
    return bundles;
  }, [bundles]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
  };

  const handleToggle = async (bundle: StudioBundle) => {
    setError(null);
    try {
      await toggleMutation.mutateAsync({ id: bundle.id, isActive: !bundle.isActive });
    } catch (err) {
      setError(extractBackendError(err));
    }
  };

  const handleDelete = async (bundle: StudioBundle) => {
    if (
      !window.confirm(
        `Supprimer le bundle « ${bundle.name} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteMutation.mutateAsync(bundle.id);
    } catch (err) {
      setError(extractBackendError(err));
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Briefcase className="h-4 w-4" />
          Bundles métier
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Catalogue des bundles
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Bibliothèques cohérentes — prompts, workflows, templates — calibrées pour un
          métier. Activez ou désactivez un bundle pour piloter sa disponibilité sur le
          tenant.
        </p>
      </header>

      {/* Filtres */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Recherche</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom du bundle…"
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
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Actualiser
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
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

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              onToggle={() => handleToggle(bundle)}
              onDelete={() => handleDelete(bundle)}
              toggling={toggleMutation.isPending && toggleMutation.variables?.id === bundle.id}
              deleting={deleteMutation.isPending && deleteMutation.variables === bundle.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BundleCard({
  bundle,
  onToggle,
  onDelete,
  toggling,
  deleting,
}: {
  readonly bundle: StudioBundle;
  readonly onToggle: () => void;
  readonly onDelete: () => void;
  readonly toggling: boolean;
  readonly deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const manifest = useMemo(() => parseBundleManifest(bundle.manifest), [bundle.manifest]);
  const description = manifest.description ?? null;
  const version = manifest.version ?? null;
  const keywords = manifest.keywords ?? [];
  const assetCounts = manifest.asset_counts ?? {};

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              bundle.isActive
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                bundle.isActive ? "bg-emerald-500" : "bg-muted-foreground/60",
              )}
            />
            {bundle.isActive ? "Actif" : "Inactif"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            <Package className="h-3 w-3" />
            {bundle.metierSlug}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-foreground">{bundle.name}</h3>
        {version && <p className="text-xs text-muted-foreground">Version {version}</p>}
      </header>

      <p className="text-sm text-muted-foreground line-clamp-3">
        {description ?? "Aucune description dans le manifest."}
      </p>

      {Object.keys(assetCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(assetCounts).map(([kind, count]) => (
            <span
              key={kind}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              title={`${count} ${ASSET_KIND_LABEL[kind]?.toLowerCase() ?? kind}`}
            >
              <Sparkles className="h-3 w-3" />
              {count} {ASSET_KIND_LABEL[kind]?.toLowerCase() ?? kind}
            </span>
          ))}
        </div>
      )}

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.slice(0, 5).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              <Tags className="h-3 w-3" />
              {k}
            </span>
          ))}
          {keywords.length > 5 && (
            <span className="text-xs text-muted-foreground">+{keywords.length - 5}</span>
          )}
        </div>
      )}

      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Projet</dt>
          <dd className="text-right text-foreground">{bundle.project.title}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Créé le</dt>
          <dd className="text-right text-foreground">{formatDateTime(bundle.createdAt)}</dd>
        </div>
      </dl>

      {expanded && bundle.manifest && (
        <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
          {bundle.manifest}
        </pre>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60",
            bundle.isActive
              ? "border border-border bg-background text-foreground hover:bg-accent"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {toggling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : bundle.isActive ? (
            "Désactiver"
          ) : (
            "Activer"
          )}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {expanded ? "Masquer" : "Manifest"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Supprimer
        </button>
      </footer>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement du catalogue…
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">Aucun bundle</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aucun bundle ne correspond à votre recherche, ou le catalogue est vide.
      </p>
    </div>
  );
}