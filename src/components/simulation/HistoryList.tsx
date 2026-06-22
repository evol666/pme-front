import { Clock, Target, Trash2 } from 'lucide-react';
import type { SimulationRun } from '@/api/simulation';
import { iconForScenario } from './icons';

type Props = {
  items: SimulationRun[];
  activeId?: string | null;
  onSelect: (id: string) => void;
};

function shortDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days < 1) return "aujourd'hui";
    if (days === 1) return 'hier';
    if (days < 7) return `il y a ${days}j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function scenarioIcon(key: string): string {
  const MAP: Record<string, string> = {
    hire_sales: 'user-plus',
    change_target: 'users',
    premium_positioning: 'gem',
    expand_eti: 'building-2',
    deploy_ai: 'sparkles',
    linkedin_campaign: 'megaphone',
    new_offer: 'box',
    pricing_change: 'tag',
    custom: 'edit-3',
  };
  return MAP[key] || 'target';
}

export default function HistoryList({ items, activeId, onSelect }: Props) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-[12px] text-muted-foreground">
        Aucune simulation passée. Lancez votre première analyse pour construire votre historique
        stratégique.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const Icon = iconForScenario(scenarioIcon(r.scenario_key));
        const active = r.id === activeId;
        const align =
          r.alignment_score != null
            ? Math.round(Math.max(0, Math.min(1, r.alignment_score)) * 100)
            : null;

        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className={[
                'group w-full rounded-xl border px-3 py-2.5 text-left transition',
                active
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card hover:border-primary/30',
                r.status === 'discarded' ? 'opacity-60' : '',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                <span
                  className={[
                    'grid h-7 w-7 shrink-0 place-items-center rounded-lg',
                    active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">
                    {r.label || r.scenario_label}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {r.scenario_label} · {shortDate(r.created_at)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {r.status === 'promoted' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                        <Target className="h-2.5 w-2.5" />
                        Promu objectif
                      </span>
                    )}
                    {r.status === 'discarded' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        <Trash2 className="h-2.5 w-2.5" />
                        Écarté
                      </span>
                    )}
                    {r.status === 'active' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        Actif
                      </span>
                    )}
                    {align != null && (
                      <span className="text-[10px] text-muted-foreground">
                        Alignement {align}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
