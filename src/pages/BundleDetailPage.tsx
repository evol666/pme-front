import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Boxes,
  Briefcase,
  Code2,
  FileText,
  Layers,
  Layout,
  Loader2,
  Network,
  Package,
  Play,
  Sparkles,
  Tags,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import {
  extractBackendError,
  formatDateTime,
  useStudioAgents,
  useStudioApiRoutes,
  useStudioPages,
  useStudioPrompts,
  useStudioWorkflows,
  type StudioAgent,
  type StudioApiRoute,
  type StudioPage,
  type StudioPrompt,
  type StudioWorkflow,
} from "@/api/bundleStudio";
import { parseBundleManifest, useBundle, useToggleBundle } from "@/api/bundles";
import { cn } from "@/lib/utils";

// Détail d'un bundle métier (route /bundles/:bundleId). Version Spring Boot : le bundle
// vient de /api/studio-bundles/{id} (bundles.ts) et ses composants (agents, prompts, pages,
// api-routes, workflows) sont fetchés séparément via /api/studio-* filtrés par
// bundleId.equals. L'activation se fait via PATCH merge-patch (useToggleBundle) — l'endpoint
// POST /api/bundles/{id}/activate FastAPI-only n'est pas migré. La section
// « Recommandations IA » (endpoint FastAPI /api/bundles/{id}/recommendations) n'est pas
// reproduite : pas d'équivalent Spring Boot. Voir [[pme-migration-fastapi-only-endpoints]].

type SectionKind = "prompt" | "workflow" | "page" | "apiRoute" | "agent";

interface Section {
  kind: SectionKind;
  label: string;
  icon: typeof Sparkles;
  description: string;
}

const SECTIONS: Section[] = [
  {
    kind: "prompt",
    label: "Prompts",
    icon: Sparkles,
    description: "Modèles de prompts IA prêts à l'emploi.",
  },
  {
    kind: "workflow",
    label: "Workflows",
    icon: Workflow,
    description: "Parcours métier déclaratifs, étape par étape.",
  },
  {
    kind: "page",
    label: "Pages",
    icon: Layout,
    description: "Pages du portail tenant dédiées au métier.",
  },
  {
    kind: "apiRoute",
    label: "Routes API",
    icon: Network,
    description: "Endpoints métier exposés par le bundle.",
  },
  {
    kind: "agent",
    label: "Agents",
    icon: Boxes,
    description: "Agents IA spécialisés pour ce métier.",
  },
];

export default function BundleDetailPage() {
  const { bundleId = "" } = useParams<{ bundleId: string }>();
  const numericId = Number(bundleId);
  const isValidId = Number.isFinite(numericId) && numericId > 0;

  const { data: bundle, isLoading, error } = useBundle(isValidId ? numericId : null);
  const toggleMutation = useToggleBundle();
  const [activated, setActivated] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const bundleIdForComponents = isValidId ? numericId : undefined;
  const agents = useStudioAgents({ bundleId: bundleIdForComponents });
  const prompts = useStudioPrompts({ bundleId: bundleIdForComponents });
  const pages = useStudioPages({ bundleId: bundleIdForComponents });
  const apiRoutes = useStudioApiRoutes({ bundleId: bundleIdForComponents });
  const workflows = useStudioWorkflows({ bundleId: bundleIdForComponents });

  const manifest = useMemo(
    () => parseBundleManifest(bundle?.manifest ?? null),
    [bundle?.manifest],
  );

  const counts: Record<SectionKind, number> = {
    prompt: prompts.data?.length ?? 0,
    workflow: workflows.data?.length ?? 0,
    page: pages.data?.length ?? 0,
    apiRoute: apiRoutes.data?.length ?? 0,
    agent: agents.data?.length ?? 0,
  };

  const handleActivate = async () => {
    if (!bundle) return;
    setActivateError(null);
    try {
      await toggleMutation.mutateAsync({ id: bundle.id, isActive: true });
      setActivated(true);
      toast.success("Bundle activé");
    } catch (err) {
      const msg = extractBackendError(err);
      setActivateError(msg);
      toast.error(msg);
    }
  };

  if (!isValidId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Identifiant de bundle invalide : « {bundleId} ».
        </div>
        <Link
          to="/bundles"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Chargement du bundle…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce bundle : {extractBackendError(error)}
        </div>
        <Link
          to="/bundles"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue
        </Link>
      </div>
    );
  }

  if (!bundle) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-10 md:py-14">
      <Link
        to="/bundles"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Catalogue des bundles
      </Link>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6 md:p-8">
        <header className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Briefcase className="h-3.5 w-3.5" />
            Bundle #{bundle.id} · {bundle.metierSlug}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {bundle.name}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {manifest.description ?? "Aucune description dans le manifest."}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <BundleStatusBadge isActive={bundle.isActive} />
            {manifest.version && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                <Package className="h-3 w-3" />
                Version {manifest.version}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Créé le {formatDateTime(bundle.createdAt)}
            </span>
          </div>
        </header>

        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <OnboardStep
            step="1"
            title="Activer le bundle"
            text="Basculez le statut du bundle pour le rendre disponible sur le tenant."
          />
          <OnboardStep
            step="2"
            title="Explorer les composants"
            text="Prompts, workflows, pages, routes API et agents dédiés au métier."
          />
          <OnboardStep
            step="3"
            title="Publier un livrable"
            text="Utilisez les prompts pour générer des synthèses métier."
          />
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <ActivateButton
            onActivate={handleActivate}
            pending={toggleMutation.isPending}
            activated={activated}
            isActive={bundle.isActive}
          />
          {activateError && (
            <span className="text-sm text-destructive">{activateError}</span>
          )}
        </div>

        <BundleManifestTargets manifest={manifest} />

        {bundle.manifest && (
          <details className="rounded-lg border border-border bg-background">
            <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-foreground">
              Manifest JSON brut
            </summary>
            <pre className="max-h-64 overflow-auto px-4 py-3 text-xs text-muted-foreground">
              {bundle.manifest}
            </pre>
          </details>
        )}
      </section>

      <BundleComponentSections
        data={{
          agents: agents.data ?? [],
          prompts: prompts.data ?? [],
          pages: pages.data ?? [],
          apiRoutes: apiRoutes.data ?? [],
          workflows: workflows.data ?? [],
        }}
      />

      {Object.values(counts).every((c) => c === 0) && (
        <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">Bundle vide</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aucun composant (prompt, workflow, page, route API, agent) n'est rattaché à ce
            bundle côté Spring Boot.
          </p>
        </section>
      )}
    </div>
  );
}

interface ComponentItem {
  id: number;
  title: string;
  subtitle: string | null;
  body: string | null;
  tags: string[];
}

function getItems(
  kind: SectionKind,
  data: {
    agents: StudioAgent[];
    prompts: StudioPrompt[];
    pages: StudioPage[];
    apiRoutes: StudioApiRoute[];
    workflows: StudioWorkflow[];
  },
): ComponentItem[] {
  switch (kind) {
    case "prompt":
      return data.prompts.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: p.category,
        body: p.template,
        tags: [],
      }));
    case "workflow":
      return data.workflows.map((w) => ({
        id: w.id,
        title: w.name,
        subtitle: w.slug,
        body: w.definition,
        tags: [],
      }));
    case "page":
      return data.pages.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.slug,
        body: p.layout,
        tags: [],
      }));
    case "apiRoute":
      return data.apiRoutes.map((r) => ({
        id: r.id,
        title: `${r.method} ${r.path}`,
        subtitle: null,
        body: r.handler,
        tags: [r.method],
      }));
    case "agent":
      return data.agents.map((a) => ({
        id: a.id,
        title: a.name,
        subtitle: a.role,
        body: a.systemPrompt,
        tags: [],
      }));
  }
}

function OnboardStep({
  step,
  title,
  text,
}: {
  readonly step: string;
  readonly title: string;
  readonly text: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {step}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function Targets({ label, items }: { readonly label: string; readonly items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

// Badge de statut actif/inactif du bundle — extrait pour éviter les ternaires
// imbriquées directement dans BundleDetailPage.
function BundleStatusBadge({ isActive }: { readonly isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-emerald-500" : "bg-muted-foreground/60",
        )}
      />
      {isActive ? "Actif" : "Inactif"}
    </span>
  );
}

// Bouton d'activation du bundle : icône + libellé dépendant de l'état
// (activation en cours / déjà actif / à activer). Extrait de BundleDetailPage
// pour réduire sa complexité cognitive.
function ActivateButton({
  onActivate,
  pending,
  activated,
  isActive,
}: {
  readonly onActivate: () => void;
  readonly pending: boolean;
  readonly activated: boolean;
  readonly isActive: boolean;
}) {
  const alreadyActive = activated || isActive;

  let icon = <Play className="h-4 w-4" />;
  if (pending) {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
  } else if (alreadyActive) {
    icon = <Sparkles className="h-4 w-4" />;
  }

  let label = "Activer ce bundle";
  if (alreadyActive) {
    label = "Bundle activé";
  } else if (pending) {
    label = "Activation en cours…";
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={pending || alreadyActive}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
    >
      {icon}
      {label}
    </button>
  );
}

// Section « Métiers ciblés / Mots-clés » du manifest — extraite pour ne pas
// ajouter sa condition d'affichage à la complexité de BundleDetailPage.
function BundleManifestTargets({
  manifest,
}: {
  readonly manifest: { metier_ids?: string[] | null; keywords?: string[] | null };
}) {
  const hasMetierIds = (manifest.metier_ids?.length ?? 0) > 0;
  const hasKeywords = (manifest.keywords?.length ?? 0) > 0;
  if (!hasMetierIds && !hasKeywords) return null;

  return (
    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
      {hasMetierIds && <Targets label="Métiers ciblés" items={manifest.metier_ids!} />}
      {hasKeywords && <Targets label="Mots-clés" items={manifest.keywords!} />}
    </div>
  );
}

// Liste des sections de composants (prompts, workflows, pages, routes API,
// agents) — extraite de BundleDetailPage pour que la boucle de rendu (avec
// son retour anticipé par section vide) ne pèse pas sur la complexité
// cognitive du composant principal.
function BundleComponentSections({
  data,
}: {
  readonly data: {
    agents: StudioAgent[];
    prompts: StudioPrompt[];
    pages: StudioPage[];
    apiRoutes: StudioApiRoute[];
    workflows: StudioWorkflow[];
  };
}) {
  return (
    <>
      {SECTIONS.map((section) => {
        const items = getItems(section.kind, data);
        if (items.length === 0) return null;
        const Icon = section.icon;
        return (
          <section key={section.kind} className="space-y-4">
            <header className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {section.label}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
            </header>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((item) => (
                <ComponentCard key={item.id} kind={section.kind} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function ComponentCard({
  kind,
  item,
}: {
  readonly kind: SectionKind;
  readonly item: ComponentItem;
}) {
  const iconByKind: Record<SectionKind, typeof Sparkles> = {
    prompt: FileText,
    workflow: Workflow,
    page: Layout,
    apiRoute: Code2,
    agent: Boxes,
  };
  const Icon = iconByKind[kind];
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <header className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</h3>
        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          <Icon className="h-3 w-3" />
          {kind}
        </span>
      </header>
      {item.subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
      )}
      {item.body && (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {item.body.slice(0, 240)}
          {item.body.length > 240 ? "…" : ""}
        </p>
      )}
      {item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span
              key={t}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <Tags className="mr-1 inline h-2.5 w-2.5" />
              {t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}