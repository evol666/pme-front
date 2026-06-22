import { ChevronRight } from 'lucide-react';
import type { ScenarioCatalogItem } from '@/api/simulation';
import { iconForScenario } from './icons';

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
  scenario: ScenarioCatalogItem;
  active?: boolean;
  onSelect?: (key: string) => void;
};

export default function ScenarioCard({ scenario, active, onSelect }: Props) {
  const Icon = iconForScenario(scenario.icon);
  const toneDot = TONE_DOT[scenario.tone] || 'bg-muted-foreground';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(scenario.key)}
      className={[
        'group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition',
        active
          ? 'border-primary/40 bg-primary/5 shadow-md'
          : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
      ].join(' ')}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span
          className={[
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition',
            active
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          ].join(' ')}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span
          className={`text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
            active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${toneDot}`} />
          {TONE_LABEL[scenario.tone] || scenario.tone}
        </span>
      </span>
      <span className="text-[14.5px] font-semibold text-foreground">{scenario.label}</span>
      <span className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
        {scenario.description}
      </span>
      <span className="mt-auto inline-flex w-full items-center justify-between text-[11px] text-muted-foreground">
        <span>Horizon ~ {scenario.estimated_horizon}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${active ? 'rotate-90 text-primary' : 'group-hover:translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}
