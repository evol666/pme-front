import { useMemo, useState } from "react";
import {
  Briefcase,
  FolderOpen,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import {
  extractBackendError,
  formatDateTime,
  parseLobJson,
  STUDIO_PROJECT_STATUS_LABEL,
  useCreateStudioProject,
  useDeleteStudioProject,
  usePatchStudioProject,
  useStudioGenerationRuns,
  useStudioProjects,
  type StudioProject,
  type StudioProjectStatus,
} from "@/api/bundleStudio";
import { useBundles } from "@/api/bundles";
import { cn } from "@/lib/utils";

// Bundle Studio — version Spring Boot CRUD. La page v2 (FastAPI) utilisait un wizard de
// génération 5 étapes avec streaming SSE (/api/bundle-studio/projects/{id}/generate-stream,
// /analyze, /preview, /publish, /templates). Ces endpoints FastAPI-only ne sont pas migrés
// côté Spring Boot — la nouvelle page est un éditeur de projets Studio et de leurs
// composants (bundles, runs de génération) via le CRUD JHipster standard. Voir
// [[pme-migration-fastapi-only-endpoints]].

const STATUS_VALUES: StudioProjectStatus[] = [
  "DRAFT",
  "ANALYZING",
  "GENERATING",
  "READY",
  "PUBLISHED",
  "ARCHIVED",
  "ERROR",
];

const STATUS_TONE: Record<StudioProjectStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ANALYZING: "bg-sky-500/10 text-sky-600",
  GENERATING: "bg-amber-500/10 text-amber-600",
  READY: "bg-emerald-500/10 text-emerald-600",
  PUBLISHED: "bg-primary/10 text-primary",
  ARCHIVED: "bg-slate-500/10 text-slate-600",
  ERROR: "bg-red-500/10 text-red-600",
};

type StatusFilter = "all" | StudioProjectStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "DRAFT", label: "Brouillons" },
  { key: "GENERATING", label: "En génération" },
  { key: "READY", label: "Prêts" },
  { key: "PUBLISHED", label: "Publiés" },
];

export default function BundleStudioPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      titleContains: appliedSearch || undefined,
      status: statusFilter === "all" ? undefined : (statusFilter as StudioProjectStatus),
    }),
    [appliedSearch, statusFilter],
  );

  const {
    data: projects,
    isLoading,
    isFetching,
    refetch,
  } = useStudioProjects(filters);
  const createMutation = useCreateStudioProject();
  const patchMutation = usePatchStudioProject();
  const deleteMutation = useDeleteStudioProject();

  const selectedProject = projects?.find((p) => p.id === selectedProjectId) ?? null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
  };

  const handleCreate = async () => {
    const title = window.prompt("Titre du nouveau projet Studio :");
    if (!title || !title.trim()) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        title: title.trim(),
        status: "DRAFT",
        brief: null,
        targetMetier: null,
        // Le backend StudioProjectService.save s'attend à recevoir tenant + user non null
        // (validations @NotNull). On transmet des refs minimales ; le backend peut rebrancher
        // sur le tenant courant / l'utilisateur authentifié côté service. Si l'API refuse,
        // la page affiche l'erreur backend.
        tenant: { id: 0 },
        user: { id: 0 },
      });
      setSelectedProjectId(created.id);
      toast.success("Projet Studio créé");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleStatusChange = async (project: StudioProject, next: StudioProjectStatus) => {
    setError(null);
    try {
      await patchMutation.mutateAsync({
        id: project.id,
        patch: { status: next },
      });
      toast.success("Statut mis à jour");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDelete = async (project: StudioProject) => {
    if (
      !window.confirm(
        `Supprimer le projet « ${project.title} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteMutation.mutateAsync(project.id);
      if (selectedProjectId === project.id) setSelectedProjectId(null);
      toast.success("Projet supprimé");
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
          <Wand2 className="h-4 w-4" />
          Bundle Studio
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Studio de création de bundles
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Pilotez les projets Studio et leurs cycles de génération. Chaque projet regroupe
          des bundles métier (prompts, workflows, pages, agents, routes API) et un journal
          des runs de génération.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Recherche</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Titre du projet…"
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
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Nouveau projet
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <LoadingState label="Chargement des projets…" />
          ) : !projects || projects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Aucun projet Studio"
              description="Créez un premier projet pour démarrer un bundle métier."
            />
          ) : (
            <ul className="space-y-3">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  selected={selectedProjectId === project.id}
                  onSelect={() => setSelectedProjectId(project.id)}
                  onStatusChange={(s) => handleStatusChange(project, s)}
                  onDelete={() => handleDelete(project)}
                  busy={
                    (patchMutation.isPending &&
                      patchMutation.variables?.id === project.id) ||
                    (deleteMutation.isPending && deleteMutation.variables === project.id)
                  }
                />
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          {selectedProject ? (
            <ProjectDetail project={selectedProject} />
          ) : (
            <EmptyState
              icon={Package}
              title="Sélectionnez un projet"
              description="Choisissez un projet à gauche pour inspecter ses bundles et runs de génération."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  selected,
  onSelect,
  onStatusChange,
  onDelete,
  busy,
}: {
  project: StudioProject;
  selected: boolean;
  onSelect: () => void;
  onStatusChange: (status: StudioProjectStatus) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const brief = useMemo(() => parseLobJson<Record<string, unknown>>(project.brief), [
    project.brief,
  ]);
  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition",
        selected ? "border-primary/60 ring-2 ring-ring" : "border-border hover:shadow-md",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2">
            {project.title}
          </h3>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium",
              STATUS_TONE[project.status],
            )}
          >
            {STUDIO_PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>
        <dl className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Métier cible</dt>
            <dd className="text-right text-foreground">
              {project.targetMetier ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Mis à jour</dt>
            <dd className="text-right text-foreground">
              {formatDateTime(project.updatedAt)}
            </dd>
          </div>
        </dl>
        {brief && typeof brief === "object" && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {JSON.stringify(brief).slice(0, 160)}
          </p>
        )}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label className="text-xs text-muted-foreground">Statut :</label>
        <select
          value={project.status}
          onChange={(e) => onStatusChange(e.target.value as StudioProjectStatus)}
          disabled={busy}
          className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {STUDIO_PROJECT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Supprimer
        </button>
      </div>
    </li>
  );
}

function ProjectDetail({ project }: { project: StudioProject }) {
  // bundles.ts n'expose pas de filtre projectId — on récupère tous les bundles du tenant
  // et on filtre côté client par project.id. Évite de modifier bundles.ts.
  const { data: allBundles, isLoading: bundlesLoading } = useBundles();
  const projectBundles = useMemo(
    () => (allBundles ?? []).filter((b) => b.project?.id === project.id),
    [allBundles, project.id],
  );

  const { data: runs, isLoading: runsLoading } = useStudioGenerationRuns({
    projectId: project.id,
  });

  const brief = useMemo(() => parseLobJson<Record<string, unknown>>(project.brief), [
    project.brief,
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <header className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Briefcase className="h-3.5 w-3.5" />
            Projet Studio
          </p>
          <h2 className="text-xl font-semibold text-foreground">{project.title}</h2>
          <p className="text-xs text-muted-foreground">
            Créé le {formatDateTime(project.createdAt)} · ID #{project.id}
          </p>
        </header>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Statut" value={STUDIO_PROJECT_STATUS_LABEL[project.status]} />
          <Field label="Métier cible" value={project.targetMetier ?? "—"} />
          <Field label="Tenant" value={project.tenant?.name ?? `#${project.tenant?.id}`} />
          <Field
            label="Utilisateur"
            value={project.user?.fullName ?? project.user?.email ?? `#${project.user?.id}`}
          />
        </dl>
        {brief && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Brief JSON</p>
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              {JSON.stringify(brief, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Bundles liés{" "}
            <span className="text-muted-foreground font-normal">
              ({projectBundles.length})
            </span>
          </h3>
        </header>
        {bundlesLoading ? (
          <LoadingState label="Chargement des bundles…" />
        ) : projectBundles.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun bundle n'a encore été rattaché à ce projet.
          </p>
        ) : (
          <ul className="space-y-2">
            {projectBundles.map((bundle) => (
              <li
                key={bundle.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{bundle.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {bundle.metierSlug} · {bundle.isActive ? "Actif" : "Inactif"}
                  </p>
                </div>
                <a
                  href={`/bundles/${bundle.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ouvrir →
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Runs de génération{" "}
            <span className="text-muted-foreground font-normal">
              ({runs?.length ?? 0})
            </span>
          </h3>
        </header>
        {runsLoading ? (
          <LoadingState label="Chargement des runs…" />
        ) : !runs || runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun run de génération enregistré pour ce projet.
          </p>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Run #{run.id}</span>
                  <span className="text-muted-foreground">{run.status}</span>
                </div>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>Début : {formatDateTime(run.createdAt)}</span>
                  <span>Fin : {formatDateTime(run.finishedAt)}</span>
                </div>
                {run.log && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded border border-border bg-background p-2 text-[10px] text-muted-foreground">
                    {run.log}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FolderOpen;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}