import { Radar, Shield, Sparkles, Target, TrendingUp } from 'lucide-react';
import type { ProactiveStatus, SchedulerStatus } from '@/api/proactive';

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  target: Target,
  sparkles: Sparkles,
  'trending-up': TrendingUp,
  shield: Shield,
  radar: Radar,
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  status: ProactiveStatus | null;
  scheduler: SchedulerStatus | null;
}

export default function MonitoringHeader({ status, scheduler }: Props) {
  const domains = status?.monitored_domains ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/90 to-primary px-6 py-5 text-primary-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Radar className="h-5 w-5 text-white/80" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/70">Mode Directeur</p>
            <h2 className="text-lg font-semibold leading-tight">
              Ce que votre IA surveille actuellement
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-medium">Surveillance active</span>
          <span className="text-white/50">·</span>
          <span className="text-white/70">
            prochaine analyse ~{fmtTime(scheduler?.next_scan_at ?? null)}
          </span>
        </div>
      </div>

      {domains.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {domains.map((d) => {
            const Icon = DOMAIN_ICONS[d.icon] || Radar;
            return (
              <span
                key={d.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/85"
              >
                <Icon className="h-3.5 w-3.5 text-white/70" />
                {d.label}
              </span>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[12.5px] leading-relaxed text-white/60">
        En continu et en arrière-plan, l'IA croise vos signaux métier pour faire remonter, à votre
        rythme, ce qui mérite votre attention — sans rien déclencher sans vous.
      </p>
    </section>
  );
}
