import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { SimulationResult, RoiLevel } from '@/api/simulation';

const ROI_LABEL: Record<RoiLevel, string> = {
  modeste: 'Modeste',
  notable: 'Notable',
  significatif: 'Significatif',
  transformateur: 'Transformateur',
};

const ROI_DOTS: Record<RoiLevel, number> = {
  modeste: 1,
  notable: 2,
  significatif: 3,
  transformateur: 4,
};

const CHARGE_LABEL: Record<string, string> = {
  legere: 'Légère',
  moderee: 'Modérée',
  soutenue: 'Soutenue',
  forte: 'Forte',
};

const MAGNITUDE_LABEL: Record<string, string> = {
  low: 'Effet modéré',
  medium: 'Effet sensible',
  high: 'Effet fort',
};

const DIRECTION_BADGE: Record<string, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  mixte: 'bg-muted text-muted-foreground border-border',
  attention: 'bg-amber-50 text-amber-800 border-amber-100',
};

type Props = {
  result: SimulationResult;
  onPromote?: () => void;
  onDiscard?: () => void;
  promoting?: boolean;
};

export default function ResultPanel({ result, onPromote, onDiscard, promoting }: Props) {
  const alignPct =
    result.alignment_score != null
      ? Math.round(Math.max(0, Math.min(1, result.alignment_score)) * 100)
      : null;

  return (
    <article className="space-y-5">
      {/* Headline */}
      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-5 py-5 shadow-sm">
        <p className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" />
          Synthèse stratégique
        </p>
        <h2 className="mt-1 text-[17px] font-semibold text-foreground">{result.headline}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {result.narrative}
        </p>
        {alignPct != null && result.aligned_with_goal && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground">
            <Compass className="h-3 w-3 text-primary" />
            Aligné avec « {result.aligned_with_goal} » · {alignPct}%
          </p>
        )}
      </header>

      {/* Grille opportunités / risques */}
      {(result.opportunities.length > 0 || result.risks.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.opportunities.length > 0 && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
              <h3 className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" />
                Opportunités
              </h3>
              <ul className="space-y-2">
                {result.opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>
                      {o.label}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({MAGNITUDE_LABEL[o.magnitude] || o.magnitude})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.risks.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
              <h3 className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Points de vigilance
              </h3>
              <ul className="space-y-2">
                {result.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Impacts */}
      {result.impacts.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 text-[12px] font-semibold text-foreground">Impacts attendus</h3>
          <div className="flex flex-wrap gap-2">
            {result.impacts.map((imp, i) => {
              const badgeCls = DIRECTION_BADGE[imp.direction] || DIRECTION_BADGE.mixte;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${badgeCls}`}
                >
                  {imp.label}
                  <span className="text-[10px] opacity-60">~{imp.horizon}</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* ROI + Charge */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 text-[12px] font-semibold text-foreground">ROI probable</h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={`h-3 w-3 rounded-full ${
                    n <= (ROI_DOTS[result.roi.level as RoiLevel] || 1)
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-[13px] font-semibold text-foreground">
              {ROI_LABEL[result.roi.level as RoiLevel] || result.roi.level}
            </span>
            <span className="text-[11px] text-muted-foreground">~{result.roi.horizon}</span>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
            {result.roi.summary}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Charge à prévoir
          </h3>
          <p className="text-[13px] font-semibold text-foreground">
            {CHARGE_LABEL[result.charge.level] || result.charge.level}
          </p>
          <p className="text-[12px] text-muted-foreground">{result.charge.range_label}</p>
        </section>
      </div>

      {/* Première étape */}
      {result.first_step && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-primary">
              Première étape recommandée
            </p>
            <p className="mt-0.5 text-[13px] text-foreground">{result.first_step}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {(onPromote || onDiscard) && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          {onPromote && (
            <button
              type="button"
              onClick={onPromote}
              disabled={promoting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Target className="h-3.5 w-3.5" />
              {promoting ? 'Promotion…' : 'Promouvoir en objectif'}
            </button>
          )}
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-[13px] text-muted-foreground hover:bg-accent"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              Écarter
            </button>
          )}
        </div>
      )}
    </article>
  );
}
