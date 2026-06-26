/**
 * ModeDirecteurPage — LOT 26 (Mode Directeur / Insights Proactifs).
 *
 * Espace « Ce que votre IA surveille actuellement » : copilote métier
 * proactif. L'IA anticipe — détecte opportunités, risques, actions,
 * tendances et signaux faibles — et priorise automatiquement.
 */
import { useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useProactiveInsights, useRecalculateInsights, useDismissInsight } from '@/api/proactive';
import MonitoringHeader from '@/components/proactive/MonitoringHeader';
import DirectorInsightCard from '@/components/proactive/DirectorInsightCard';

export default function ModeDirecteurPage() {
  const { data, isLoading } = useProactiveInsights();
  const recalculate = useRecalculateInsights();
  const dismiss = useDismissInsight();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const insights = (data?.insights ?? []).filter((i) => !dismissedIds.has(i.id));
  const status = data?.status ?? null;
  const scheduler = data?.scheduler ?? null;

  const onRecalculate = () => recalculate.mutate();

  const onDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    dismiss.mutate(id);
  };

  return (
    <div className="space-y-8 pb-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Mode Directeur
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          Votre IA travaille pour vous, en continu.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Pendant que vous avancez, l'IA surveille votre activité et fait remonter ce qui compte :
          une opportunité, un point de vigilance, une action utile. À vous de décider — rien ne se
          déclenche sans vous.
        </p>
      </header>

      <div className="mt-6">
        <MonitoringHeader status={status} scheduler={scheduler} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {status
            ? `${status.active_count} élément${status.active_count > 1 ? 's' : ''} sous surveillance`
            : 'Analyse en cours…'}
        </p>
        <button
          type="button"
          onClick={onRecalculate}
          disabled={recalculate.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${recalculate.isPending ? 'animate-spin' : ''}`}
          />
          {recalculate.isPending ? 'Analyse…' : 'Relancer l\'analyse'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-border bg-muted/40"
              />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="font-semibold text-foreground">Tout est sous contrôle</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Aucun point d'attention pour le moment. L'IA continue de surveiller votre activité et
              vous préviendra dès qu'un signal mérite votre regard.
            </p>
          </div>
        ) : (
          insights.map((insight) => (
            <DirectorInsightCard
              key={insight.id}
              insight={insight}
              onDismiss={onDismiss}
            />
          ))
        )}
      </div>

      <p className="mt-8 text-center text-[12px] text-muted-foreground">
        Analyse 100 % locale et explicable · vos données ne quittent pas votre environnement.
      </p>
    </div>
  );
}
