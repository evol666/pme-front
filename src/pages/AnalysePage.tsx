import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useAnalysisStatus } from "@/api/analyses";
import { cn } from "@/lib/utils";

// AnalysePage — suivi d'un job d'analyse asynchrone (Kafka).
// Lit jobId dans la query string, sonde le statut via useAnalysisStatus
// (refetchInterval 3000ms géré par le hook) et redirige vers /resultat
// dès que le job atteint l'état "completed".

const TERMINAL_FAILED = new Set(["failed", "error"]);

const STEP_LABEL: Record<string, string> = {
  pending: "En attente de traitement",
  fetching: "Récupération des données entreprise",
  enriching: "Enrichissement métier",
  analyzing: "Analyse IA",
  generating: "Génération du livrable",
  publishing: "Publication",
};

export default function AnalysePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const jobId = params.get("jobId");

  const { data, isLoading, isError, error } = useAnalysisStatus(jobId);

  const status = data?.status ?? "pending";
  const isCompleted = status === "completed";
  const isFailed = TERMINAL_FAILED.has(status);

  // Redirection automatique vers le résultat une fois terminé.
  useEffect(() => {
    if (isCompleted && jobId) {
      navigate(`/resultat?jobId=${encodeURIComponent(jobId)}`, { replace: true });
    }
  }, [isCompleted, jobId, navigate]);

  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-foreground">Job manquant</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aucun identifiant de job fourni. Retournez à la liste des analyses.
        </p>
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

  const progress = data?.progress ?? 0;
  const stepLabel =
    data?.current_step == null
      ? "Initialisation…"
      : (STEP_LABEL[data.current_step] ?? data.current_step);

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          {isFailed ? (
            <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
          ) : (
            <Loader2 className="w-8 h-8 text-primary animate-spin flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              {isFailed ? "Analyse en échec" : "Analyse en cours"}
            </h1>
            <p className="text-xs text-muted-foreground font-mono truncate">
              Job {jobId}
            </p>
          </div>
        </div>

        {isError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-600">
            Impossible de récupérer le statut du job.
            <pre className="mt-2 text-xs whitespace-pre-wrap font-mono">
              {String(
                (error as {
                  response?: { data?: { error?: { message?: string } } };
                })?.response?.data?.error?.message ??
                  error?.message,
              )}
            </pre>
          </div>
        )}
        {!isError && isFailed && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-600">
            {data?.error ?? "Une erreur est survenue pendant l'analyse."}
          </div>
        )}
        {!isError && !isFailed && (
          <>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>{isLoading ? "Démarrage…" : stepLabel}</span>
                <span className="font-semibold text-foreground">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-accent overflow-hidden">
                <div
                  className={cn(
                    "h-full bg-primary transition-all duration-500",
                    isLoading && "opacity-40",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, progress))}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Cette étape peut prendre quelques minutes. Vous serez redirigé
              automatiquement vers le résultat.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={() => navigate("/analyses")}
          className="w-full inline-flex items-center justify-center h-10 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          Retour aux analyses
        </button>
      </div>
    </div>
  );
}