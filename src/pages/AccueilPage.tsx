import { Link } from "react-router-dom";
import {
  BarChart3,
  FileText,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { useAnalyses } from "@/api/analyses";
import { useRecommandations } from "@/api/recommandations";
import { useDocuments } from "@/api/documents";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";

// AccueilPage — tableau de bord d'accueil agrégeant les données du backend
// Spring Boot (analyses, recommandations, documents). Remplace le Dashboard
// temporaire. Aucune dépendance FastAPI.

function Tile({
  to,
  label,
  value,
  hint,
  icon: Icon,
}: {
  readonly to: string;
  readonly label: string;
  readonly value: number | string;
  readonly hint: string;
  readonly icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="group bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-3xl font-extrabold tracking-tight text-foreground">
          {value}
        </span>
      </div>
      <p className="mt-4 text-sm font-bold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
    </Link>
  );
}

// Traduction des statuts
const STATUS_LABEL: Record<string, string> = {
  pending:    "En attente",
  processing: "En cours",
  running:    "En cours",
  completed:  "Terminée",
  failed:     "Échec",
  error:      "Erreur",
};

const RECO_STATUS_LABEL: Record<string, string> = {
  new:       "Nouveau",
  seen:      "Vue",
  accepted:  "Acceptée",
  dismissed: "Écarté",
};

function statusTone(status: string): string {
  if (status === "completed")
    return "bg-emerald-500/10 text-emerald-600";
  if (["failed", "error"].includes(status))
    return "bg-red-500/10 text-red-600";
  return "bg-primary/10 text-primary";
}

export default function AccueilPage() {
  const username = useAppSelector((s) => s.auth.username);
  const { data: analyses } = useAnalyses();
  const { data: recommandations } = useRecommandations();
  const { data: documents } = useDocuments();

  const recentAnalyses = (analyses ?? []).slice(0, 5);
  const recentRecos = (recommandations ?? []).slice(0, 5);
  const pendingDocs = (documents ?? []).filter(
    (d) => d.status === "PENDING" || d.status === "INDEXING",
  ).length;
  const newRecos = (recommandations ?? []).filter(
    (r) => !["seen", "accepted", "dismissed"].includes(r.status),
  ).length;

  const greeting = username ?? "Bienvenue";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Accueil
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
          Bonjour, {greeting}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d'ensemble de votre activité Athanor PME.
        </p>
      </header>

      {/* Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          to="/analyses"
          label="Analyses"
          value={analyses?.length ?? 0}
          hint="Analyses d'entreprise"
          icon={BarChart3}
        />
        <Tile
          to="/analyses"
          label="Recommandations"
          value={newRecos}
          hint={`${recommandations?.length ?? 0} au total · ${newRecos} nouvelles`}
          icon={Lightbulb}
        />
        <Tile
          to="/entreprises"
          label="Documents"
          value={documents?.length ?? 0}
          hint={
            pendingDocs > 0
              ? `${pendingDocs} en cours d'indexation`
              : "Documents dans la base RAG"
          }
          icon={FileText}
        />
      </div>

      {/* Analyses récentes */}
      <section className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Analyses récentes
          </h2>
          <Link
            to="/analyses"
            className="text-xs font-bold text-primary hover:underline"
          >
            Tout voir
          </Link>
        </div>
        {recentAnalyses.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Aucune analyse.{" "}
            <Link to="/analyses" className="text-primary hover:underline">
              Lancez la première
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {recentAnalyses.map((job) => (
              <li key={job.job_id} className="px-6 py-3 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {job.company_name ?? job.siren}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    SIREN {job.siren}
                    {job.detected_business_label
                      ? ` · ${job.detected_business_label}`
                      : ""}
                  </p>
                </div>
                {job.score != null && (
                  <span className="text-sm font-bold text-foreground">
                    {Math.round(job.score)}
                  </span>
                )}
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    statusTone(job.status),
                  )}
                >
                  {STATUS_LABEL[job.status] ?? job.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recommandations récentes */}
      <section className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Recommandations récentes
          </h2>
          <Link
            to="/entreprises"
            className="text-xs font-bold text-primary hover:underline"
          >
            Tout voir
          </Link>
        </div>
        {recentRecos.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Aucune recommandation pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {recentRecos.map((r) => (
              <li key={r.id} className="px-6 py-3 flex items-center gap-4">
                <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm text-foreground truncate flex-1">
                  {r.title ?? r.action}
                </p>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    statusTone(r.status),
                  )}
                >
                  {RECO_STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}