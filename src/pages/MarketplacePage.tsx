import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  CheckCircle2,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import {
  parsePluginManifest,
  useInstallPlugin,
  useMarketplaceInstallations,
  useMarketplacePlugins,
  useUninstallPlugin,
  type MarketplaceInstallation,
  type MarketplacePlugin,
} from "@/api/marketplace";
import { useTenants } from "@/api/admin";
import { cn } from "@/lib/utils";

// Marketplace — catalogue de plugins (agents, workflows, connecteurs, templates,
// bundles métier) + état d'installation par tenant. Version Spring Boot : le
// catalogue vient du CRUD `/api/marketplace-plugins` (filtres Criteria
// `label.contains` + `kind.equals` + `status.equals`), les installations viennent
// de `/api/marketplace-installations`. L'install/uninstall FastAPI-only est
// reconstruit : POST d'une MarketplaceInstallation pour installer, DELETE pour
// désinstaller. Voir [[pme-migration-fastapi-only-endpoints]].

const KIND_LABEL: Record<string, string> = {
  agent: "Agent IA",
  workflow: "Workflow",
  connector: "Connecteur",
  template: "Template",
  bundle: "Bundle métier",
};

const KIND_ORDER = ["", "agent", "workflow", "connector", "template", "bundle"];

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  ...KIND_ORDER.slice(1).map((k) => ({ key: k, label: KIND_LABEL[k] })),
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

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { data: plugins, isLoading, refetch, isFetching } = useMarketplacePlugins(
    kindFilter || undefined,
    undefined,
    appliedSearch || undefined,
  );
  const { data: installations } = useMarketplaceInstallations();
  const { data: tenants } = useTenants();

  const installMutation = useInstallPlugin();
  const uninstallMutation = useUninstallPlugin();

  // Map pluginId -> installation "installed" (pour afficher le badge et l'action
  // désinstaller). On ne considère que les installations actives.
  const installedByPluginId = useMemo(() => {
    const map = new Map<number, MarketplaceInstallation>();
    for (const inst of installations ?? []) {
      if (inst.status === "installed" && inst.plugin?.id != null) {
        map.set(inst.plugin.id, inst);
      }
    }
    return map;
  }, [installations]);

  // Tenant cible pour l'installation : par défaut le premier tenant disponible. La
  // v2 n'avait pas de sélecteur (endpoint FastAPI implicite), mais Spring Boot
  // exige un tenant @NotNull dans le corps de l'installation.
  const defaultTenantId = tenants?.[0]?.id ?? null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
  };

  const handleInstall = async (plugin: MarketplacePlugin) => {
    if (defaultTenantId == null) {
      const msg =
        "Aucun tenant disponible pour l'installation. Créez un tenant d'abord.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError(null);
    try {
      await installMutation.mutateAsync({
        pluginId: plugin.id,
        tenantId: defaultTenantId,
      });
      toast.success(`Plugin « ${plugin.label} » installé.`);
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleUninstall = async (plugin: MarketplacePlugin) => {
    const inst = installedByPluginId.get(plugin.id);
    if (inst == null) return;
    setError(null);
    try {
      await uninstallMutation.mutateAsync(inst.id);
      toast.success(`Plugin « ${plugin.label} » désinstallé.`);
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Boxes className="h-4 w-4" />
          Marketplace
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Catalogue de plugins
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Agents, workflows, connecteurs, templates et bundles métier. Installez un
          plugin sur votre tenant pour le rendre disponible.
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
                placeholder="Nom du plugin…"
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
              key={tab.key || "all"}
              type="button"
              onClick={() => setKindFilter(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                kindFilter === tab.key
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
      ) : !plugins || plugins.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              installed={installedByPluginId.has(plugin.id)}
              installing={
                installMutation.isPending &&
                installMutation.variables?.pluginId === plugin.id
              }
              uninstalling={
                uninstallMutation.isPending &&
                installedByPluginId.get(plugin.id)?.id === uninstallMutation.variables
              }
              onInstall={() => handleInstall(plugin)}
              onUninstall={() => handleUninstall(plugin)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PluginCard({
  plugin,
  installed,
  installing,
  uninstalling,
  onInstall,
  onUninstall,
}: {
  plugin: MarketplacePlugin;
  installed: boolean;
  installing: boolean;
  uninstalling: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const manifest = useMemo(() => parsePluginManifest(plugin.manifest), [plugin.manifest]);
  const description = plugin.description ?? manifest.description ?? null;
  const version = plugin.version || manifest.version || null;
  const keywords = manifest.keywords ?? [];

  return (
    <article className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
      {installed && (
        <CheckCircle2
          className="absolute right-4 top-4 h-5 w-5 text-emerald-600"
          aria-label="Installé"
        />
      )}

      <header className="space-y-2">
        <div className="flex items-center gap-2 pr-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            <Package className="h-3 w-3" />
            {KIND_LABEL[plugin.kind] ?? plugin.kind}
          </span>
          {version && (
            <span className="text-xs text-muted-foreground tabular-nums">v{version}</span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{plugin.label}</h3>
      </header>

      {description ? (
        <p className="text-sm text-muted-foreground line-clamp-3">{description}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">Aucune description.</p>
      )}

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.slice(0, 4).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {k}
            </span>
          ))}
          {keywords.length > 4 && (
            <span className="text-xs text-muted-foreground">+{keywords.length - 4}</span>
          )}
        </div>
      )}

      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Auteur</dt>
          <dd className="text-right text-foreground">{plugin.author ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Statut</dt>
          <dd className="text-right text-foreground">{plugin.status}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Créé le</dt>
          <dd className="text-right text-foreground">{formatDateTime(plugin.createdAt)}</dd>
        </div>
      </dl>

      <footer className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        {installed ? (
          <button
            type="button"
            onClick={onUninstall}
            disabled={uninstalling}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {uninstalling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Désinstaller
          </button>
        ) : (
          <button
            type="button"
            onClick={onInstall}
            disabled={installing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {installing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Installer
          </button>
        )}
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
      <p className="text-sm font-medium text-foreground">Aucun plugin</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aucun plugin ne correspond à votre recherche, ou le catalogue est vide.
      </p>
    </div>
  );
}