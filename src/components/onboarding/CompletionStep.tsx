import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileCheck2, PartyPopper, Sparkles } from 'lucide-react';
import type { OnboardingSummary } from '@/api/onboarding';
import ScoreGauge from './ScoreGauge';

type Props = {
  readonly summary: OnboardingSummary | null;
};

export default function CompletionStep({ summary }: Props) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Félicitations !</h2>
        <p className="text-sm text-muted-foreground">Votre espace est prêt à l'emploi.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-5">
          {summary?.maturity_score != null ? (
            <ScoreGauge
              score={summary.maturity_score}
              level={summary.maturity_level}
              size={120}
              caption="Maturité"
            />
          ) : (
            <>
              <Sparkles className="h-7 w-7 text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Diagnostic à affiner</p>
            </>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card p-5">
          <FileCheck2 className="h-7 w-7 text-cyan-600" />
          <p className="text-3xl font-bold text-foreground">
            {summary?.documents_count ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">Documents intégrés</p>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card p-5">
          <Sparkles className="h-7 w-7 text-emerald-500" />
          <p className="text-sm font-semibold text-foreground">
            {summary?.first_deliverable?.label ?? 'Premier livrable'}
          </p>
          <p className="text-xs text-muted-foreground">généré</p>
        </div>
      </div>

      {summary?.next_actions && summary.next_actions.length > 0 && (
        <div className="rounded-2xl border border-border bg-muted/30 p-5 text-left">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Prochaines actions recommandées
          </p>
          <ul className="space-y-2">
            {summary.next_actions.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => a.deep_route && navigate(a.deep_route)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span>{a.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/accueil')}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium mx-auto inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
      >
        Accéder à mon espace
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
