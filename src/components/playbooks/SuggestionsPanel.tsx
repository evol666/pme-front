import { Brain, Lightbulb, MessageSquare, Sparkles, TrendingUp } from 'lucide-react';
import type { PlaybookStats, PlaybookSuggestion } from '@/api/playbooks';

type Props = {
  readonly stats: PlaybookStats | null;
  readonly suggestions: PlaybookSuggestion[];
};

const KIND_ICON: Record<string, typeof Lightbulb> = {
  missing_step: Lightbulb,
  automation: Sparkles,
  tone: MessageSquare,
  note: Brain,
};

const SOURCE_LABEL: Record<string, string> = {
  heuristic: 'Heuristique',
  stats: 'Statistiques',
  llm: 'Analyse IA des notes',
};

const IMPACT_DOTS: Record<string, number> = { low: 1, medium: 2, high: 3 };

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <li className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label} :</span>
      <span className="text-[12.5px] font-semibold text-foreground">{value}</span>
    </li>
  );
}

export default function SuggestionsPanel({ stats, suggestions }: Props) {
  return (
    <section className="space-y-4">
      {stats && stats.runs_total > 0 && (
        <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
          <header className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 opacity-70" />
            Vos statistiques
          </header>
          <ul className="grid grid-cols-2 gap-y-1.5 text-[12.5px]">
            <Stat label="Runs lancés" value={String(stats.runs_total)} />
            <Stat label="Terminés" value={String(stats.runs_completed)} />
            <Stat label="Taux complétion" value={`${Math.round(stats.completion_rate * 100)}%`} />
            {stats.avg_duration_days != null && (
              <Stat label="Durée moyenne" value={`${Math.round(stats.avg_duration_days)} j`} />
            )}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 shadow-sm">
          <header className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Suggestions d'amélioration
          </header>
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const Icon = KIND_ICON[s.kind] || Lightbulb;
              const dots = IMPACT_DOTS[s.impact] || 2;
              return (
                <li key={s.label} className="flex items-start gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-3 w-3" strokeWidth={2.3} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">{s.label}</p>
                    {s.rationale && (
                      <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                        {s.rationale}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                      <span>Source : {SOURCE_LABEL[s.source] || s.source}</span>
                      <span className="inline-flex gap-0.5">
                        {[1, 2, 3].map((d) => (
                          <span
                            key={d}
                            className={
                              d <= dots
                                ? 'h-1 w-1 rounded-full bg-primary'
                                : 'h-1 w-1 rounded-full bg-border'
                            }
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(!stats || stats.runs_total === 0) && suggestions.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-3 text-[11.5px] text-muted-foreground">
          Pas encore assez de données pour proposer des améliorations. Lancez quelques runs.
        </p>
      )}
    </section>
  );
}
