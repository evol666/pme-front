import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, FileText, Loader2, Download } from "lucide-react";
import { useAnalysisStatus, type AnalysisStatus } from "@/api/analyses";
import {
  useExportDocument,
  type Proposal,
  type ProposalRecommendation,
  type ProposalActionStep,
} from "@/api/export";

// ResultatPage — affiche le livrable d'une analyse terminée (proposal/diagnostic)
// et propose l'export PDF/DOCX.
//
// Note : le backend renvoie `proposal`/`diagnostic` sous forme de chaînes
// (markdown) tandis que l'endpoint d'export attend un objet `Proposal` structuré.
// On reconstruit au mieux un Proposal depuis les champs disponibles
// (executiveSummary <- proposal, contextAnalysis <- diagnostic, et mapping
// défensif de recommended_tools/workflows). Les champs non disponibles restent vides.

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toRecommendations(
  tools: Array<Record<string, unknown>> | null,
): ProposalRecommendation[] {
  if (!tools || tools.length === 0) return [];
  return tools.slice(0, 12).map((t) => ({
    titre: str(t.titre ?? t.name ?? t.label ?? t.title),
    description: str(t.description ?? t.rationale ?? t.summary),
    priorite: str(t.priorite ?? t.priority ?? t.severity ?? "normale"),
  }));
}

function toActionPlan(
  workflows: Array<Record<string, unknown>> | null,
): ProposalActionStep[] {
  if (!workflows || workflows.length === 0) return [];
  return workflows.slice(0, 12).map((w) => ({
    titre: str(w.titre ?? w.name ?? w.label ?? w.title),
    description: str(w.description ?? w.summary),
    duree: str(w.duree ?? w.duration ?? w.effort ?? "—"),
  }));
}

function buildProposal(status: AnalysisStatus): Proposal {
  return {
    executiveSummary: str(status.proposal),
    contextAnalysis: str(status.diagnostic),
    recommendations: toRecommendations(status.recommended_tools),
    actionPlan: toActionPlan(status.workflows),
    expectedBenefits: "",
    nextSteps: "",
  };
}

function companyName(status: AnalysisStatus): string | undefined {
  const c = status.company;
  if (c && typeof c === "object") {
    const name = (c as Record<string, unknown>).name;
    if (typeof name === "string" && name) return name;
  }
  return undefined;
}

function metierLabel(status: AnalysisStatus): string | undefined {
  const b = status.detected_business;
  if (b && typeof b === "object") {
    const label = (b as Record<string, unknown>).label;
    if (typeof label === "string" && label) return label;
  }
  return undefined;
}

export default function ResultatPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const jobId = params.get("jobId");

  const { data, isLoading, isError, error } = useAnalysisStatus(jobId);
  const exportMutation = useExportDocument();

  const proposal = useMemo(() => (data ? buildProposal(data) : null), [data]);

  const handleExport = (format: "pdf" | "docx") => {
    if (!data || !proposal) return;
    exportMutation.mutate({
      format,
      request: {
        proposition: proposal,
        meta: {
          company_name: companyName(data),
          metier_label: metierLabel(data),
        },
      },
    });
  };

  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-foreground">Job manquant</h1>
        <button
          type="button"
          onClick={() => navigate("/analyses")}
          className="mt-6 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90"
        >
          Retour aux analyses
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement du résultat…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-foreground">
          Résultat indisponible
        </h1>
        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono max-w-lg">
          {String(
            (error as { response?: { data?: { error?: { message?: string } } } })
              ?.response?.data?.error?.message ?? (error as Error)?.message,
          )}
        </pre>
        <button
          type="button"
          onClick={() => navigate("/analyses")}
          className="mt-6 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90"
        >
          Retour aux analyses
        </button>
      </div>
    );
  }

  const title = companyName(data) ?? jobId;
  const completed = data.status === "completed";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Retour"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {completed ? "Livrable" : "Analyse"}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
            {metierLabel(data) && (
              <p className="text-sm text-muted-foreground">{metierLabel(data)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exportMutation.isPending || !completed}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("docx")}
            disabled={exportMutation.isPending || !completed}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            DOCX
          </button>
        </div>
      </header>

      {exportMutation.isError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
          Échec de l'export.{" "}
          {String(
            (exportMutation.error as {
              response?: { data?: { error?: { message?: string } } };
            })?.response?.data?.error?.message ??
              (exportMutation.error as Error)?.message,
          )}
        </div>
      )}

      <Section
        title="Proposition"
        icon={<FileText className="w-4 h-4" />}
        content={data.proposal}
      />
      <Section
        title="Diagnostic"
        icon={<FileText className="w-4 h-4" />}
        content={data.diagnostic}
      />

      {proposal && proposal.recommendations.length > 0 && (
        <Card title="Recommandations">
          <ul className="space-y-3">
            {proposal.recommendations.map((r, i) => (
              <li
                key={i}
                className="rounded-lg border border-border/50 p-4 bg-background"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {r.titre || `Recommandation ${i + 1}`}
                  </p>
                  {r.priorite && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {r.priorite}
                    </span>
                  )}
                </div>
                {r.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {proposal && proposal.actionPlan.length > 0 && (
        <Card title="Plan d'action">
          <ol className="space-y-3">
            {proposal.actionPlan.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {step.titre || `Étape ${i + 1}`}
                    </p>
                    {step.duree && (
                      <span className="text-[10px] text-muted-foreground">
                        {step.duree}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  content,
}: {
  title: string;
  icon: React.ReactNode;
  content: string | null;
}) {
  return (
    <Card title={title} icon={icon}>
      {content ? (
        <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Aucun contenu disponible.
        </p>
      )}
    </Card>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}