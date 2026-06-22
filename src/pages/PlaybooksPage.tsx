/**
 * PlaybooksPage — LOT 31 (Moteur de Playbooks intelligents).
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, FlaskConical, Layers, RefreshCw } from 'lucide-react';
import {
  usePlaybooksOverview,
  useStartPlaybookRun,
  type PlaybookRun,
  type PlaybookCatalogItem,
} from '@/api/playbooks';
import PlaybookCard from '@/components/playbooks/PlaybookCard';
import ActiveRunCard from '@/components/playbooks/ActiveRunCard';

export default function PlaybooksPage() {
  const navigate = useNavigate();
  const { data: overview, isLoading, refetch } = usePlaybooksOverview();
  const startRun = useStartPlaybookRun();

  const catalog: PlaybookCatalogItem[] = overview?.catalog ?? [];
  const activeRuns: PlaybookRun[] = overview?.active_runs ?? [];

  const catalogByKey = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of catalog) m.set(p.key, p.icon);
    return m;
  }, [catalog]);

  const onStartPlaybook = async (playbookKey: string) => {
    const run = await startRun.mutateAsync({ playbook_key: playbookKey });
    if (run) navigate(`/playbooks/${run.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Layers className="h-3 w-3" />
            Playbooks intelligents
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            L'IA vous accompagne dans vos processus réels
          </h1>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Choisissez un playbook — l'IA orchestre ensuite actions, modules, workflows et
            recommandations adaptés à votre contexte.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </header>

      {activeRuns.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-foreground">
            <Compass className="h-3.5 w-3.5 text-primary" />
            Playbooks en cours
            <span className="text-[11px] font-normal text-muted-foreground">
              ({activeRuns.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeRuns.map((run: PlaybookRun) => (
              <ActiveRunCard
                key={run.id}
                run={run}
                playbookIcon={catalogByKey.get(run.playbook_key) || null}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-primary" />
          Lancer un nouveau playbook
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((pb: PlaybookCatalogItem) => (
              <PlaybookCard
                key={pb.key}
                playbook={pb}
                onStart={(key) => {
                  if (!startRun.isPending) void onStartPlaybook(key);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        Les playbooks orchestrent vos processus métier : ils référencent des modules, des workflows
        et des recommandations existants. Vos notes alimentent les suggestions d'amélioration.
      </footer>
    </div>
  );
}
