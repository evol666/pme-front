import type { PlaybookRun, StepStatus } from '@/api/playbooks';

type Props = {
  run: PlaybookRun;
  compact?: boolean;
};

function statusCount(run: PlaybookRun, status: StepStatus): number {
  return run.steps.filter((s) => s.status === status).length;
}

function progressLabel(pct: number, status: string): string {
  if (status === 'completed') return 'Terminé';
  if (status === 'abandoned') return 'Abandonné';
  if (pct >= 0.8) return 'Bientôt bouclé';
  if (pct >= 0.4) return 'Bien engagé';
  if (pct > 0) return 'En cours';
  return 'Tout juste lancé';
}

export default function PlaybookProgress({ run, compact }: Props) {
  const pct = Math.max(0, Math.min(1, run.completion_pct || 0));
  const pctDisplay = Math.round(pct * 100);
  const label = progressLabel(pct, run.status);

  const done = statusCount(run, 'done');
  const inProgress = statusCount(run, 'in_progress');
  const skipped = statusCount(run, 'skipped');
  const total = run.steps.length;

  const fillClass =
    run.status === 'completed'
      ? 'bg-emerald-500'
      : run.status === 'abandoned'
        ? 'bg-muted-foreground/40'
        : pct >= 0.8
          ? 'bg-primary'
          : 'bg-cyan-500';

  return (
    <div className={compact ? '' : 'space-y-2'}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{pctDisplay}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${fillClass} transition-all duration-700`}
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span>
            <span className="font-semibold text-emerald-600">{done}</span>/{total} fait
            {done > 1 ? 's' : ''}
          </span>
          {inProgress > 0 && (
            <span>
              <span className="font-semibold text-primary">{inProgress}</span> en cours
            </span>
          )}
          {skipped > 0 && (
            <span>
              <span className="font-semibold text-muted-foreground">{skipped}</span> ignorée
              {skipped > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
