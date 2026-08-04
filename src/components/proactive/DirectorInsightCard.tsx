import { useState } from 'react';
import { useNavigate } from "react-router";
import {
  ArrowRight,
  ChevronDown,
  Info,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import type { DirectorInsight } from '@/api/proactive';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  shield: ShieldCheck,
  target: Target,
  'trending-up': TrendingUp,
  radar: Radar,
};

const TONE: Record<string, { ring: string; chip: string; label: string }> = {
  positive: {
    ring: 'border-emerald-200 bg-emerald-50/60',
    chip: 'bg-emerald-100 text-emerald-700',
    label: 'Opportunité',
  },
  info: {
    ring: 'border-primary/20 bg-primary/5',
    chip: 'bg-primary/10 text-primary',
    label: 'À considérer',
  },
  attention: {
    ring: 'border-amber-200 bg-amber-50/60',
    chip: 'bg-amber-100 text-amber-700',
    label: 'Point de vigilance',
  },
};

const KIND_LABEL: Record<string, string> = {
  opportunity: 'Opportunité',
  risk: 'Vigilance',
  action: 'Action suggérée',
  trend: 'Tendance',
  watch: 'Sous surveillance',
};

interface Props {
  readonly insight: DirectorInsight;
  readonly onDismiss: (id: string) => void;
}

// Couleur du bouton d'action selon le ton de l'insight — table de
// correspondance plutôt que ternaires imbriquées.
function actionButtonClass(tone: string | undefined): string {
  if (tone === 'positive') return 'bg-emerald-600 hover:bg-emerald-700';
  if (tone === 'attention') return 'bg-amber-600 hover:bg-amber-700';
  return 'bg-primary hover:bg-primary/90';
}

export default function DirectorInsightCard({ insight, onDismiss }: Props) {
  const [showWhy, setShowWhy] = useState(false);
  const navigate = useNavigate();

  const tone = TONE[insight.tone || 'info'] || TONE.info;
  const Icon = ICONS[insight.icon || 'radar'] || Radar;
  const confidencePct = Math.round((insight.confidence || 0) * 100);
  const action = insight.suggested_action;

  const actionBg = actionButtonClass(insight.tone);

  return (
    <article
      className={`group relative rounded-2xl border ${tone.ring} px-5 py-4 shadow-sm transition-shadow hover:shadow-md`}
    >
      <button
        type="button"
        onClick={() => onDismiss(insight.id)}
        aria-label="Écarter cette suggestion"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.chip}`}
            >
              {KIND_LABEL[insight.kind] || tone.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Confiance estimée {confidencePct}%
            </span>
          </div>

          <h3 className="mt-1.5 pr-6 text-[15px] font-semibold text-foreground">
            {insight.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {insight.message}
          </p>

          <div className="mt-2.5 inline-flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Info className="h-3.5 w-3.5" />
              Pourquoi l'IA me le signale ?
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showWhy ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {showWhy && (
            <div className="mt-2 rounded-xl border border-border bg-card/70 px-3 py-2.5 text-[12.5px] text-muted-foreground">
              <p className="leading-relaxed">{insight.rationale}</p>
              {insight.signals.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {insight.signals.map((s) => (
                    <li key={s} className="flex items-start gap-1.5">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {action && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => action.target && navigate(action.target)}
                disabled={!action.target}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition disabled:cursor-default disabled:opacity-60 ${actionBg}`}
              >
                {action.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              {action.hint && (
                <span className="text-[12px] text-muted-foreground">{action.hint}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
