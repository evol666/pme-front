import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lightbulb,
  ListChecks,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { useAnalysisStatus, type AnalysisStatus } from "@/api/analyses";
import {
  useExportDocument,
  type Proposal,
  type ProposalRecommendation,
  type ProposalActionStep,
} from "@/api/export";

// ResultatPage — affiche le livrable d'une analyse terminée sous forme de
// sections lisibles (résumé, contexte, recommandations, plan d'action,
// bénéfices, prochaines étapes) et propose l'export PDF/DOCX.
//
// Le backend renvoie `proposal` sous forme de chaîne JSON structurée. On la
// parse pour le rendu ET pour l'export ; en cas d'échec on retombe sur un
// rendu texte brut.

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

type ParsedProposal = {
  executiveSummary?: unknown;
  contextAnalysis?: unknown;
  recommendations?: Array<Record<string, unknown>>;
  actionPlan?: Array<Record<string, unknown>>;
  expectedBenefits?: unknown;
  nextSteps?: unknown;
};

function parseProposal(raw: string | null): ParsedProposal | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s.startsWith("{")) return null;
  try {
    const o = JSON.parse(s);
    if (o && typeof o === "object" && !Array.isArray(o)) {
      return o as ParsedProposal;
    }
  } catch {
    /* pas du JSON — rendu brut */
  }
  return null;
}

function toRecommendations(
  items: Array<Record<string, unknown>> | null | undefined,
): ProposalRecommendation[] {
  if (!items || items.length === 0) return [];
  return items.slice(0, 20).map((t) => ({
    titre: str(t.titre ?? t.name ?? t.label ?? t.title),
    description: str(t.description ?? t.rationale ?? t.summary),
    priorite: str(t.priorite ?? t.priority ?? t.severity ?? "normale"),
  }));
}

function toActionPlan(
  items: Array<Record<string, unknown>> | null | undefined,
): ProposalActionStep[] {
  if (!items || items.length === 0) return [];
  return items.slice(0, 20).map((w) => ({
    titre: str(w.titre ?? w.name ?? w.label ?? w.title),
    description: str(w.description ?? w.summary),
    duree: str(w.duree ?? w.duration ?? w.effort ?? "—"),
  }));
}

function buildProposal(
  status: AnalysisStatus,
  parsed: ParsedProposal | null,
): Proposal {
  if (parsed) {
    return {
      executiveSummary: str(parsed.executiveSummary),
      contextAnalysis: str(parsed.contextAnalysis) || str(status.diagnostic),
      recommendations: toRecommendations(parsed.recommendations),
      actionPlan: toActionPlan(parsed.actionPlan),
      expectedBenefits: str(parsed.expectedBenefits),
      nextSteps: str(parsed.nextSteps),
    };
  }
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

function prioriteTone(p: string): string {
  const v = p.toLowerCase();
  if (["haute", "high", "critique", "critical", "urgent", "p1", "1"].some((k) => v.includes(k)))
    return "bg-red-500/10 text-red-600 border border-red-500/20";
  if (["moyenne", "medium", "p2", "2"].some((k) => v.includes(k)))
    return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
  return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
}

export default function ResultatPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const jobId = params.get("jobId");

  const { data, isLoading, isError, error } = useAnalysisStatus(jobId);
  const exportMutation = useExportDocument();

  const parsed = useMemo(
    () => (data ? parseProposal(data.proposal) : null),
    [data],
  );
  const proposal = useMemo(
    () => (data ? buildProposal(data, parsed) : null),
    [data, parsed],
  );

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
  const p = proposal as Proposal;
  const hasStructured =
    !!p.executiveSummary ||
    !!p.contextAnalysis ||
    p.recommendations.length > 0 ||
    p.actionPlan.length > 0 ||
    !!p.expectedBenefits ||
    !!p.nextSteps;

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
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600">
          Échec de l'export.{" "}
          {String(
            (exportMutation.error as {
              response?: { data?: { error?: { message?: string } } };
            })?.response?.data?.error?.message ??
              (exportMutation.error as Error)?.message,
          )}
        </div>
      )}

      {hasStructured ? (
        <div className="space-y-6">
          {p.executiveSummary && (
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary mb-3">
                <Sparkles className="w-4 h-4" />
                Résumé exécutif
              </h2>
              <Prose text={p.executiveSummary} className="text-foreground" />
            </section>
          )}

          {p.contextAnalysis && (
            <Card title="Analyse du contexte" icon={<Target className="w-4 h-4" />}>
              <Prose text={p.contextAnalysis} />
            </Card>
          )}

          {p.recommendations.length > 0 && (
            <Card
              title="Recommandations"
              icon={<Lightbulb className="w-4 h-4" />}
            >
              <ul className="space-y-3">
                {p.recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-border/50 p-4 bg-background"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {r.titre || `Recommandation ${i + 1}`}
                      </p>
                      {r.priorite && (
                        <span
                          className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${prioriteTone(
                            r.priorite,
                          )}`}
                        >
                          {r.priorite}
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {p.actionPlan.length > 0 && (
            <Card title="Plan d'action" icon={<ListChecks className="w-4 h-4" />}>
              <ol className="relative space-y-5 before:absolute before:left-[15px] before:top-1 before:bottom-1 before:w-px before:bg-border">
                {p.actionPlan.map((step, i) => (
                  <li key={i} className="relative flex gap-4">
                    <span className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {step.titre || `Étape ${i + 1}`}
                        </p>
                        {step.duree && step.duree !== "—" && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            {step.duree}
                          </span>
                        )}
                      </div>
                      {step.description && (
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {p.expectedBenefits && (
            <Card
              title="Bénéfices attendus"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              <Prose text={p.expectedBenefits} />
            </Card>
          )}

          {p.nextSteps && (
            <Card
              title="Prochaines étapes"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              <Prose text={p.nextSteps} />
            </Card>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function Prose({ text, className }: { text: string; className?: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) {
    return (
      <p
        className={`text-sm leading-relaxed whitespace-pre-wrap ${
          className ?? "text-muted-foreground"
        }`}
      >
        {text}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => (
        <p
          key={i}
          className={`text-sm leading-relaxed ${
            className ?? "text-muted-foreground"
          }`}
        >
          {para}
        </p>
      ))}
    </div>
  );
}

function Section({
  title,
  icon,
  content,
}: {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly content: string | null;
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
  readonly title: string;
  readonly icon?: React.ReactNode;
  readonly children: React.ReactNode;
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
