/**
 * MaturityPage — LOT 33 (Système de Maturité Entreprise).
 *
 * Évalue, benchmarke et accompagne la progression sur 8 dimensions.
 */
import { useState } from 'react';
import { ArrowRight, RefreshCw, Target, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useMaturityReport,
  useRecalculateMaturity,
  useMaturityCatalog,
  useMaturityQuestions,
  useAnswerMaturityQuestion,
  type DimensionScore,
  type RoadmapAction,
} from '@/api/maturity';

const SECTORS_LABEL: Record<string, string> = {
  services_b2b: 'Services B2B',
  industrie: 'Industrie',
  retail: 'Retail / Distribution',
  tech: 'Tech / SaaS',
  sante: 'Santé',
  btp: 'BTP / Construction',
  finance: 'Finance / Assurance',
  public: 'Secteur public',
  generaliste: 'Généraliste',
};

const SIZES_LABEL: Record<string, string> = {
  tpe: 'TPE (1-9)',
  pme: 'PME (10-49)',
  eti_small: 'ETI 50-250',
  eti_large: 'ETI 250-5000',
  ge: 'Grand groupe',
};

const LEVEL_LABEL: Record<string, string> = {
  emerging: 'Émergent',
  established: 'Établi',
  advanced: 'Avancé',
  optimized: 'Optimisé',
};

const IMPACT_LABEL: Record<string, string> = {
  low: 'Impact modéré',
  medium: 'Impact sensible',
  high: 'Impact fort',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-cyan-500';
  if (score >= 30) return 'bg-primary';
  return 'bg-amber-500';
}

function DimensionCard({ dim }: { dim: DimensionScore }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-foreground">{dim.dimension_label}</p>
          <p className="text-[11px] text-muted-foreground">
            {LEVEL_LABEL[dim.level] ?? dim.level}
          </p>
        </div>
        <span className="text-lg font-bold text-foreground tabular-nums">
          {Math.round(dim.score)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${scoreColor(dim.score)} transition-all duration-700`}
          style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
        />
      </div>
      {dim.benchmark != null && (
        <p className="mt-1 text-[10.5px] text-muted-foreground">
          Référentiel : {Math.round(dim.benchmark)}
          {dim.delta_vs_benchmark != null && (
            <span
              className={
                dim.delta_vs_benchmark >= 0 ? 'ml-1 text-emerald-600' : 'ml-1 text-amber-600'
              }
            >
              ({dim.delta_vs_benchmark >= 0 ? '+' : ''}
              {Math.round(dim.delta_vs_benchmark)})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function RoadmapPanel({ actions }: { actions: RoadmapAction[] }) {
  const navigate = useNavigate();
  if (actions.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-[14px] font-semibold text-foreground">Roadmap IA actionnable</h2>
      <ul className="space-y-3">
        {actions.slice(0, 8).map((a, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{a.action_label}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">{a.rationale}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>{a.dimension_label}</span>
                <span>·</span>
                <span className={a.impact === 'high' ? 'text-primary font-medium' : ''}>
                  {IMPACT_LABEL[a.impact] ?? a.impact}
                </span>
              </div>
            </div>
            {a.deep_route && (
              <button
                type="button"
                onClick={() => navigate(a.deep_route!)}
                className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MaturityPage() {
  const [secteur, setSecteur] = useState('generaliste');
  const [taille, setTaille] = useState('pme');

  const { data: report, isLoading } = useMaturityReport(secteur, taille);
  const { data: catalog = [] } = useMaturityCatalog();
  const { data: questions = [] } = useMaturityQuestions();
  const recalculate = useRecalculateMaturity();
  const answerQuestion = useAnswerMaturityQuestion();

  const snapshot = report?.snapshot;

  const catalogIconMap = new Map(
    catalog.map((d) => [d.key, { icon: d.icon, accent: d.accent }]),
  );

  const onRecompute = () => recalculate.mutate({ secteur, taille });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Target className="h-3 w-3" />
            Maturité entreprise
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            L'IA évalue, benchmarke et accompagne votre progression
          </h1>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            8 dimensions clés évaluées à partir de vos signaux d'usage, comparées à un référentiel
            sectoriel, et déclinées en roadmap actionnable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] font-medium text-foreground focus:outline-none"
          >
            {Object.entries(SECTORS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={taille}
            onChange={(e) => setTaille(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] font-medium text-foreground focus:outline-none"
          >
            {Object.entries(SIZES_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRecompute}
            disabled={recalculate.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recalculate.isPending ? 'animate-spin' : ''}`} />
            {recalculate.isPending ? 'Calcul…' : 'Recalculer'}
          </button>
        </div>
      </header>

      {isLoading && !snapshot ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : snapshot ? (
        <>
          {/* Score global */}
          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - snapshot.global_score / 100)}
                    style={{ transition: 'stroke-dashoffset 700ms ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-foreground">
                    {Math.round(snapshot.global_score)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {LEVEL_LABEL[snapshot.overall_level] ?? snapshot.overall_level}
                </p>
                <p className="text-sm text-muted-foreground">
                  Score global de maturité IA · {secteur} · {SIZES_LABEL[taille]}
                </p>
                {report.trend && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Tendance : {report.trend === 'rising' ? 'En hausse' : report.trend === 'stable' ? 'Stable' : 'En baisse'}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Dimensions */}
          <section className="mb-6">
            <h2 className="mb-3 text-[14px] font-semibold text-foreground">Vos 8 dimensions</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {snapshot.dimensions.map((d) => (
                <DimensionCard key={d.dimension_key} dim={d} />
              ))}
            </div>
          </section>

          {/* Roadmap */}
          <section className="mb-6">
            <RoadmapPanel actions={report.roadmap} />
          </section>

          {/* Questions opt-in */}
          {questions.length > 0 && (
            <section className="mb-6">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-3 text-[14px] font-semibold text-foreground">
                  Affinez votre score
                </h2>
                <p className="mb-4 text-[12.5px] text-muted-foreground">
                  Répondez à quelques questions pour améliorer la précision de votre score.
                </p>
                <ul className="space-y-4">
                  {questions.slice(0, 5).map((q) => (
                    <li key={`${q.dimension_key}-${q.key}`}>
                      <p className="text-[13px] font-medium text-foreground">{q.label}</p>
                      <p className="mb-1 text-[11px] text-muted-foreground">{q.dimension_label}</p>
                      {q.type === 'yesno' ? (
                        <div className="flex gap-2">
                          {['oui', 'non'].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                answerQuestion.mutate({
                                  dimensionKey: q.dimension_key,
                                  questionKey: q.key,
                                  value: opt,
                                })
                              }
                              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium capitalize transition ${
                                q.value === opt
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-card text-foreground hover:bg-accent'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : q.type === 'scale' ? (
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                answerQuestion.mutate({
                                  dimensionKey: q.dimension_key,
                                  questionKey: q.key,
                                  value: n,
                                })
                              }
                              className={`h-8 w-8 rounded-lg border text-[12px] font-medium transition ${
                                q.value === n
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-card text-foreground hover:bg-accent'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      ) : q.options.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                answerQuestion.mutate({
                                  dimensionKey: q.dimension_key,
                                  questionKey: q.key,
                                  value: opt,
                                })
                              }
                              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                                q.value === opt
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-card text-foreground hover:bg-accent'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      ) : null}

      <footer className="mt-6 rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        Le score est calculé déterministiquement à partir de vos signaux d'usage. Le référentiel
        est statique et sert de repère, pas de vérité absolue.
      </footer>
    </div>
  );
}
