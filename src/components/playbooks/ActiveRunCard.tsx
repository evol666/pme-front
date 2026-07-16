import React from 'react';
import { ArrowRight, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PlaybookRun } from '@/api/playbooks';
import { iconForPlaybook } from './icons';
import PlaybookProgress from './PlaybookProgress';

type Props = {
  readonly run: PlaybookRun;
  readonly playbookIcon?: string | null;
};

function shortDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

export default function ActiveRunCard({ run, playbookIcon }: Props) {
  const iconEl = React.createElement(iconForPlaybook(playbookIcon), { className: 'h-3.5 w-3.5', strokeWidth: 2.2 });
  const align =
    run.alignment_score == null
      ? null
      : Math.round(Math.max(0, Math.min(1, run.alignment_score)) * 100);

  return (
    <Link
      to={`/playbooks/${run.id}`}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <header className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {iconEl}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {run.label || run.playbook_label}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {run.playbook_label}
            {run.started_at && <> · lancé {shortDate(run.started_at)}</>}
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </header>

      <PlaybookProgress run={run} compact={false} />

      {(run.mission_aligned_goal || align != null) && (
        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Target className="h-3 w-3" />
          <span>
            {run.mission_aligned_goal}
            {align == null ? '' : ` · ${align}%`}
          </span>
        </p>
      )}
    </Link>
  );
}
