import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { PlaybookCatalogItem } from '@/api/playbooks';
import { iconForPlaybook } from './icons';

const TONE_LABEL: Record<string, string> = {
  croissance: 'Croissance',
  structuration: 'Structuration',
  prudence: 'Prudence',
  exploration: 'Exploration',
};

const TONE_DOT: Record<string, string> = {
  croissance: 'bg-emerald-500',
  structuration: 'bg-primary',
  prudence: 'bg-amber-500',
  exploration: 'bg-cyan-500',
};

type Props = {
  readonly playbook: PlaybookCatalogItem;
  readonly onStart?: (key: string) => void;
};

export default function PlaybookCard({ playbook, onStart }: Props) {
  const iconEl = React.createElement(iconForPlaybook(playbook.icon), { className: 'h-4 w-4', strokeWidth: 2.2 });
  const toneDot = TONE_DOT[playbook.tone] || 'bg-muted-foreground';

  return (
    <button
      type="button"
      onClick={() => onStart?.(playbook.key)}
      className="group flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
          {iconEl}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${toneDot}`} />
          {TONE_LABEL[playbook.tone] || playbook.tone}
        </span>
      </span>
      <span className="text-[14.5px] font-semibold text-foreground">{playbook.label}</span>
      <span className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
        {playbook.description}
      </span>
      <span className="mt-auto inline-flex w-full items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {playbook.steps.length} étape{playbook.steps.length > 1 ? 's' : ''}
        </span>
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
