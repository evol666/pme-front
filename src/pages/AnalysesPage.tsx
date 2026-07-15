import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Loader2, Play, RefreshCw, Search } from "lucide-react";
import { useAnalyses, useLaunchAnalysis } from "@/api/analyses";
import { cn } from "@/lib/utils";

// AnalysesPage — liste des jobs d'analyse d'entreprise (flux /api/company/analyze).
// L'utilisateur saisit un SIREN (9 chiffres), déclenche l'analyse puis est
// redirigé vers /analyse?jobId=xxx pour le suivi du job asynchrone (Kafka).

const SIREN_RE = /^\d{9}$/;

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  running: "En cours",
  completed: "Terminée",
  failed: "Échec",
  error: "Erreur",
};

function StatusBadge({ status }: { readonly status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const tone = cn(
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
    status === "completed"
      ? "bg-emerald-500/10 text-emerald-600"
      : ["failed", "error"].includes(status)
        ? "bg-red-500/10 text-red-600"
        : "bg-primary/10 text-primary",
  );
  return <span className={tone}>{label}</span>;
}

export default function AnalysesPage() {
  const navigate = useNavigate();
  const { data: analyses, isLoading, isFetching, refetch } = useAnalyses();
  const launch = useLaunchAnalysis();

  const [siren, setSiren] = useState("");
  const [metierForce, setMetierForce] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = siren.replace(/\s+/g, "");
    if (!SIREN_RE.test(trimmed)) {
      setFormError("Le SIREN doit comporter 9 chiffres.");
      return;
    }
    setFormError(null);
    try {
      const ack = await launch.mutateAsync({
        siren: trimmed,
        metier_force: metierForce.trim() || undefined,
      });
      navigate(`/analyse?jobId=${encodeURIComponent(ack.job_id)}`);
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      setFormError(
        axiosErr?.response?.data?.error?.message ??
          "Impossible de lancer l'analyse.",
      );
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Analyses
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Analyses d'entreprise
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lancez une analyse à partir d'un SIREN et suivez son avancement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Rafraîchir
        </button>
      </header>

      {/* Formulaire de lancement */}
      <form
        onSubmit={handleLaunch}
        className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4"
      >
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          Nouvelle analyse
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <label
              htmlFor="siren"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              SIREN (9 chiffres)
            </label>
            <input
              id="siren"
              value={siren}
              onChange={(e) => setSiren(e.target.value)}
              placeholder="123456782"
              inputMode="numeric"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label
              htmlFor="metier"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              Métier (forçage, optionnel)
            </label>
            <input
              id="metier"
              value={metierForce}
              onChange={(e) => setMetierForce(e.target.value)}
              placeholder="ex. boulangerie"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            type="submit"
            disabled={launch.isPending}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {launch.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Lancer
          </button>
        </div>
        {formError && (
          <p className="text-sm text-red-600">{formError}</p>
        )}
      </form>

      {/* Historique des jobs */}
      <section className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Historique
          </h2>
          <span className="text-xs text-muted-foreground">
            {analyses?.length ?? 0} analyse(s)
          </span>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement…
          </div>
        ) : !analyses || analyses.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Search className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucune analyse pour le moment. Lancez-en une ci-dessus.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {analyses.map((job) => (
              <li
                key={job.job_id}
                className="px-6 py-4 flex items-center gap-4 hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() =>
                  navigate(`/analyse?jobId=${encodeURIComponent(job.job_id)}`)
                }
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {job.company_name ?? job.siren}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    SIREN {job.siren}
                    {job.detected_business_label
                      ? ` · ${job.detected_business_label}`
                      : ""}
                    {job.current_step ? ` · ${job.current_step}` : ""}
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  {job.score != null && (
                    <p className="text-sm font-bold text-foreground">
                      {Math.round(job.score)}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {job.created_at
                      ? new Date(job.created_at).toLocaleDateString("fr-FR")
                      : ""}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}