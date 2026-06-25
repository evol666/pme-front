import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lightbulb,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Workflow,
  Calendar,
  Users,
} from "lucide-react";
import {
  useEntreprise,
  useRefreshEntreprise,
  type ScoreAxe,
  type BodaccSignal,
} from "@/api/entreprises";
import { usePortefeuilleEntreprise, RELATION_TYPES } from "@/api/portefeuille";
import { useAnalyses, useLaunchAnalysis } from "@/api/analyses";
import { useRecommandationsForJobs } from "@/api/recommandations";
import { useDocuments } from "@/api/documents";
import { useJournalEvents } from "@/api/journal";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

const TABS = [
  { id: "identite",         label: "Identité",          icon: Building2   },
  { id: "analyses",         label: "Analyses",           icon: BarChart3   },
  { id: "recommandations",  label: "Recommandations",    icon: Lightbulb   },
  { id: "documents",        label: "Documents",          icon: FileText    },
  { id: "journal",          label: "Journal",            icon: BookOpen    },
  { id: "copilote",         label: "Copilote IA",        icon: Sparkles    },
  { id: "playbooks",        label: "Playbooks",          icon: Workflow    },
] as const;

type TabId = typeof TABS[number]["id"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EntrepriseDetailPage() {
  const { siren } = useParams<{ siren: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") ?? "identite") as TabId;

  function setTab(id: TabId) {
    setSearchParams({ tab: id }, { replace: true });
  }

  const { data: enriched, isLoading, isError } = useEntreprise(siren);
  const { data: portefeuille } = usePortefeuilleEntreprise(siren);
  const refresh = useRefreshEntreprise();

  if (!siren || !/^\d{9}$/.test(siren)) {
    return <ErrorView message={`SIREN invalide : ${siren}`} />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm">Enrichissement en cours pour {siren}…</p>
      </div>
    );
  }

  if (isError || !enriched) {
    return <ErrorView message="Impossible de charger cette entreprise" onBack={() => navigate(-1)} />;
  }

  const { identite, scoring } = enriched;

  if (!identite) {
    return <ErrorView message="Données d'identité indisponibles pour ce SIREN" onBack={() => navigate(-1)} />;
  }
  const kindLabel = portefeuille
    ? RELATION_TYPES.find(r => r.value === portefeuille.kind)?.label
    : null;

  return (
    <div className="space-y-0">
      {/* ------------------------------------------------------------------ */}
      {/* En-tête entreprise                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden mb-4">
        {/* Bandeau couleur selon severity */}
        <div className={cn(
          "h-1.5",
          scoring?.severity === "faible" ? "bg-emerald-500" :
          scoring?.severity === "modéré" ? "bg-amber-400" :
          scoring ? "bg-red-500" : "bg-muted",
        )} />

        <div className="px-6 pt-5 pb-4">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate("/entreprises")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Portefeuille
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-extrabold text-foreground">
                  {identite.raison_sociale ?? siren}
                </h1>
                <StatusBadge statut={identite.statut} />
                {kindLabel && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {kindLabel}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{siren}</span>
                {identite.code_naf && (
                  <span>{identite.code_naf} · {identite.libelle_naf}</span>
                )}
                {identite.ville && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {identite.ville}
                  </span>
                )}
                {identite.date_creation && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {enriched.synthese.points_cles.anciennete_ans} ans
                  </span>
                )}
              </div>
            </div>

            {/* Score + refresh */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {scoring && (
              <div className={cn(
                "w-16 h-16 rounded-2xl flex flex-col items-center justify-center",
                scoring.severity === "faible" ? "bg-emerald-500/10 text-emerald-600" :
                scoring.severity === "modéré" ? "bg-amber-500/10 text-amber-500" :
                "bg-red-500/10 text-red-500",
              )}>
                <span className="text-2xl font-extrabold leading-none">{scoring.score_global}</span>
                <span className="text-[9px] font-bold text-muted-foreground mt-0.5">/100</span>
              </div>
              )}
              <button
                onClick={() => refresh.mutate(siren)}
                disabled={refresh.isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3 h-3", refresh.isPending && "animate-spin")} />
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Barre d'onglets */}
        <div className="flex overflow-x-auto border-t border-border scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Contenu de l'onglet actif                                           */}
      {/* ------------------------------------------------------------------ */}
      <div>
        {activeTab === "identite"         && <TabIdentite enriched={enriched} />}
        {activeTab === "analyses"         && <TabAnalyses siren={siren} />}
        {activeTab === "recommandations"  && <TabRecommandations siren={siren} />}
        {activeTab === "documents"        && <TabDocuments siren={siren} />}
        {activeTab === "journal"          && <TabJournal />}
        {activeTab === "copilote"         && <TabCopilote siren={siren} raisonSociale={identite.raison_sociale ?? siren} />}
        {activeTab === "playbooks"        && <TabPlaybooks />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Identité
// ---------------------------------------------------------------------------

function TabIdentite({ enriched }: { enriched: import("@/api/entreprises").EntrepriseEnrichie }) {
  const { identite, scoring, bodacc, geolocalisation, synthese } = enriched;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Score */}
      <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold">Score PME Platform</h2>
          {scoring && (
            <span className="ml-auto text-2xl font-extrabold">
              {scoring.score_global}<span className="text-base font-normal text-muted-foreground">/100</span>
            </span>
          )}
        </div>
        <div className="space-y-3">
          {scoring && Object.entries(scoring.axes).map(([key, axe]) => (
            <AxeRow key={key} axeKey={key} axe={axe} />
          ))}
        </div>
      </div>

      {/* Identité + Géo */}
      <div className="space-y-4">
        <IdentiteCard identite={identite} />
        {geolocalisation && (
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold">Localisation</h2>
            </div>
            <p className="text-xs text-muted-foreground">{geolocalisation.label}</p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${geolocalisation.latitude}&mlon=${geolocalisation.longitude}&zoom=15`}
              target="_blank" rel="noreferrer"
              className="block mt-2 text-xs text-primary hover:underline"
            >
              Voir sur OpenStreetMap →
            </a>
          </div>
        )}
      </div>

      {/* Dirigeants */}
      {identite.dirigeants.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Dirigeants</h2>
          </div>
          <div className="divide-y divide-border/50">
            {identite.dirigeants.map((d, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(d.prenoms?.[0] ?? d.nom?.[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{[d.prenoms, d.nom].filter(Boolean).join(" ") || "—"}</p>
                  <p className="text-xs text-muted-foreground">{d.qualite}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BODACC */}
      <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold">BODACC</h2>
          <span className="text-xs text-muted-foreground ml-1">{bodacc.signaux.total} événements</span>
          {bodacc.signaux.risque > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-xs font-bold">
              ⚠ {bodacc.signaux.risque} risque{bodacc.signaux.risque > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {bodacc.evenements.slice(0, 5).map((ev, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-muted/30 text-xs">
              <span className="text-muted-foreground w-20 flex-shrink-0">
                {new Date(ev.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}
              </span>
              <span className="font-medium text-foreground">{ev.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Synthèse */}
      <div className="lg:col-span-3 bg-muted/30 border border-border/40 rounded-xl px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Synthèse</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{synthese.texte}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Analyses
// ---------------------------------------------------------------------------

function TabAnalyses({ siren }: { siren: string }) {
  const navigate = useNavigate();
  const { data: analyses, isLoading, refetch, isFetching } = useAnalyses(siren);
  const launch = useLaunchAnalysis();

  async function handleLaunch() {
    const ack = await launch.mutateAsync({ siren });
    navigate(`/analyse?jobId=${ack.job_id}`);
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: "En attente", processing: "En cours", running: "En cours",
    completed: "Terminée", failed: "Échec", error: "Erreur",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Analyses IA</h2>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
          <button
            onClick={handleLaunch}
            disabled={launch.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Nouvelle analyse
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (analyses ?? []).length === 0 ? (
        <EmptyTab
          icon={BarChart3}
          title="Aucune analyse pour ce SIREN"
          action={{ label: "Lancer une analyse", onClick: handleLaunch }}
        />
      ) : (
        <div className="space-y-2">
          {(analyses ?? []).map((a) => (
            <button
              key={a.job_id}
              onClick={() => navigate(`/analyse?jobId=${a.job_id}`)}
              className="w-full flex items-center gap-4 p-4 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-all text-left"
            >
              <div className={cn(
                "flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold",
                a.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                ["failed","error"].includes(a.status) ? "bg-red-500/10 text-red-600" :
                "bg-primary/10 text-primary",
              )}>
                {STATUS_LABEL[a.status] ?? a.status}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {a.company_name ?? siren}
                </p>
                {a.created_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(a.created_at).toLocaleString("fr-FR")}
                  </p>
                )}
              </div>
              {a.score != null && (
                <span className="text-sm font-bold text-foreground flex-shrink-0">{a.score}/100</span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Recommandations
// ---------------------------------------------------------------------------

function TabRecommandations({ siren }: { siren: string }) {
  // Recommandations propres à l'entreprise : on récupère les analyses du SIREN,
  // puis les recommandations rattachées à ces jobId.
  const { data: analyses } = useAnalyses(siren);
  const jobIds = (analyses ?? []).map((a) => a.job_id).filter(Boolean);
  const { data: recos, isLoading } = useRecommandationsForJobs(jobIds);

  const filtered = (recos ?? []).slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Recommandations IA</h2>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyTab icon={Lightbulb} title="Aucune recommandation" />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="p-4 bg-card border border-border/50 rounded-xl">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex-shrink-0 mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold",
                  r.priority <= 2 ? "bg-red-500/10 text-red-600" :
                  r.priority <= 4 ? "bg-amber-500/10 text-amber-600" :
                  "bg-muted text-muted-foreground",
                )}>
                  P{r.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{r.title ?? r.action}</p>
                  {r.rationale && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.rationale}</p>
                  )}
                </div>
                {r.score != null && (
                  <span className="text-xs font-bold text-foreground flex-shrink-0">
                    {Math.round(r.score * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Documents
// ---------------------------------------------------------------------------

function TabDocuments({ siren: _siren }: { siren: string }) {
  const { data: docs, isLoading } = useDocuments();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Documents</h2>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (docs ?? []).length === 0 ? (
        <EmptyTab
          icon={FileText}
          title="Aucun document"
        />
      ) : (
        <div className="space-y-2">
          {(docs ?? []).slice(0, 15).map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-xl">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{d.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Journal
// ---------------------------------------------------------------------------

function TabJournal() {
  const { data, isLoading } = useJournalEvents({ size: 15, sort: "occurredAt,desc" });
  const events = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Journal d'activité</h2>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <EmptyTab icon={BookOpen} title="Aucun événement dans le journal" />
      ) : (
        <div className="relative pl-4 border-l border-border/50 space-y-4">
          {events.map((e) => (
            <div key={e.id} className="relative">
              <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-primary/30 border-2 border-background" />
              <div className="bg-card border border-border/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-muted/50 rounded-md text-xs font-medium text-muted-foreground">
                    {e.kind}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(e.occurredAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                {e.content && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Copilote
// ---------------------------------------------------------------------------

function TabCopilote({ siren, raisonSociale }: { siren: string; raisonSociale: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Sparkles className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Copilote IA</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Posez des questions contextuelles sur <strong>{raisonSociale}</strong> — analyses, recommandations, stratégie.
        </p>
      </div>
      <button
        onClick={() => navigate(`/copilote?context=siren:${siren}`)}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Ouvrir le Copilote
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Playbooks
// ---------------------------------------------------------------------------

function TabPlaybooks() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Workflow className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Playbooks</p>
        <p className="text-xs text-muted-foreground mt-1">
          Automatisations et workflows d'action pour cette entreprise.
        </p>
      </div>
      <button
        onClick={() => navigate("/playbooks")}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <Workflow className="w-4 h-4" />
        Gérer les playbooks
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composants partagés
// ---------------------------------------------------------------------------

function StatusBadge({ statut }: { statut: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
      statut === "actif"
        ? "bg-emerald-500/10 text-emerald-600"
        : "bg-amber-500/10 text-amber-600",
    )}>
      <CheckCircle2 className="w-3 h-3" />
      {statut === "actif" ? "Actif" : "Cessé"}
    </span>
  );
}

const AXE_LABELS: Record<string, string> = {
  stabilite: "Stabilité", croissance: "Croissance", risque: "Risque",
  maturite_naf: "Maturité NAF", solidite_dirigeants: "Dirigeants",
};

function AxeRow({ axeKey, axe }: { axeKey: string; axe: ScoreAxe }) {
  const barColor =
    axe.score >= 70 ? "bg-emerald-500" :
    axe.score >= 40 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-foreground w-32 flex-shrink-0">{AXE_LABELS[axeKey] ?? axeKey}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${axe.score}%` }} />
      </div>
      <span className="text-xs font-bold text-foreground w-7 text-right">{axe.score}</span>
    </div>
  );
}

function IdentiteCard({ identite }: { identite: import("@/api/entreprises").Identite }) {
  const rows = [
    { label: "Forme jur.", value: identite.forme_juridique_libelle ?? identite.forme_juridique },
    { label: "Effectif",   value: identite.effectif_tranche ? `Tranche ${identite.effectif_tranche}` : null },
    { label: "Catégorie",  value: identite.categorie },
    { label: "Risque NAF", value: identite.risque_sectoriel },
    { label: "Dept.",      value: identite.departement },
  ].filter(r => r.value);

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold">Identité</h2>
      </div>
      <dl className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-semibold text-foreground text-right truncate">{r.value}</dd>
          </div>
        ))}
      </dl>
      {identite.convention_collective && (
        <p className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground line-clamp-2">
          📋 {identite.convention_collective}
        </p>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <span className="text-sm">Chargement…</span>
    </div>
  );
}

function EmptyTab({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ElementType;
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-4 text-center bg-card border border-border/50 rounded-2xl">
      <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
        <Icon className="w-6 h-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">{title}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {action.label}
        </button>
      )}
    </div>
  );
}

function ErrorView({ message, onBack }: { message: string; onBack?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-muted-foreground">
      <AlertTriangle className="w-8 h-8 text-destructive" />
      <p className="text-sm font-medium">{message}</p>
      {onBack && (
        <button onClick={onBack} className="text-xs text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      )}
    </div>
  );
}
