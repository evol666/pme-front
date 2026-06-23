import { useState } from "react";
import { Lightbulb, Loader2, RefreshCw, ThumbsDown, ThumbsUp, Eye } from "lucide-react";
import {
  useRecommandations,
  useRecommandationFeedback,
  type AiRecommendation,
  type RecommendationFeedback,
} from "@/api/recommandations";
import { cn } from "@/lib/utils";

// RecommandationsPage — liste des recommandations IA mises en cache par le
// backend (générées lors des analyses via consumer Kafka) + feedback
// (seen / accepted / dismissed) via PATCH sur le CRUD JHipster.
//
// Note : la génération contextuelle et le catalogue d'actions de l'ancien
// frontend FastAPI (/api/recommendations/contextual, /actions) n'existent pas
// côté Spring Boot — laissés en attente de backend (voir mémoire de migration).

const PRIORITY_LABEL: Record<number, string> = {
  1: "Haute",
  2: "Moyenne",
  3: "Basse",
};

function StatusPill({ status }: { status: string }) {
  const accepted = status === "accepted";
  const dismissed = status === "dismissed";
  const seen = status === "seen";
  const tone = accepted
    ? "bg-emerald-500/10 text-emerald-600"
    : dismissed
      ? "bg-red-500/10 text-red-600"
      : seen
        ? "bg-primary/10 text-primary"
        : "bg-accent text-muted-foreground";
  const label = accepted
    ? "Acceptée"
    : dismissed
      ? "Écartée"
      : seen
        ? "Vue"
        : "Nouvelle";
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function RecommendationCard({
  rec,
  onFeedback,
  pending,
}: {
  rec: AiRecommendation;
  onFeedback: (id: number, feedback: RecommendationFeedback) => void;
  pending: boolean;
}) {
  return (
    <li className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {PRIORITY_LABEL[rec.priority] ?? `P${rec.priority}`}
            </span>
            {rec.category && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {rec.category}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-bold text-foreground">
            {rec.title ?? rec.action}
          </h3>
        </div>
        <StatusPill status={rec.status} />
      </div>

      {rec.rationale && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {rec.rationale}
        </p>
      )}

      {rec.reasons && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-accent/40 rounded-lg p-3">
          {rec.reasons}
        </pre>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>Score {Math.round(rec.score)}</span>
          <span>Confiance {Math.round(rec.confidence * 100)}%</span>
          {rec.createdAt && (
            <span>{new Date(rec.createdAt).toLocaleDateString("fr-FR")}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onFeedback(rec.id, "seen")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
            title="Marquer comme vue"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onFeedback(rec.id, "accepted")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-500/30 text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50"
            title="Accepter"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onFeedback(rec.id, "dismissed")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-red-500/30 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
            title="Écarter"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function RecommandationsPage() {
  const { data, isLoading, isFetching, refetch } = useRecommandations();
  const feedback = useRecommandationFeedback();
  const [filter, setFilter] = useState<"all" | "new" | "accepted" | "dismissed">(
    "all",
  );

  const handleFeedback = (id: number, fb: RecommendationFeedback) => {
    feedback.mutate({ id, feedback: fb });
  };

  const filtered = (data ?? []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "new")
      return !["seen", "accepted", "dismissed"].includes(r.status);
    return r.status === filter;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            IA
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Recommandations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recommandations issues de vos analyses. Donnez votre feedback pour
            affiner les suivantes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Rafraîchir
        </button>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "new", "accepted", "dismissed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {f === "all"
              ? "Toutes"
              : f === "new"
                ? "Nouvelles"
                : f === "accepted"
                  ? "Acceptées"
                  : "Écartées"}
          </button>
        ))}
      </div>

      {feedback.isError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600">
          Échec du feedback.{" "}
          {String(
            (feedback.error as {
              response?: { data?: { error?: { message?: string } } };
            })?.response?.data?.error?.message ??
              (feedback.error as Error)?.message,
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Lightbulb className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucune recommandation
            {filter !== "all" ? " dans ce filtre" : ""} pour le moment.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onFeedback={handleFeedback}
              pending={feedback.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}