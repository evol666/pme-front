/**
 * SimulationPage — LOT 30 (Mode Simulation stratégique).
 *
 * Layout cabinet de conseil :
 *   ┌──────────────────────────┬─────────────────┐
 *   │  Sélecteur scénarios     │  Historique     │
 *   ├──────────────────────────┤  (sticky)       │
 *   │  Form params + bouton    │                 │
 *   ├──────────────────────────┤                 │
 *   │  ResultPanel             │                 │
 *   └──────────────────────────┴─────────────────┘
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, RefreshCw, Sparkles } from 'lucide-react';
import {
  useSimulationCatalog,
  useSimulationHistory,
  useRunSimulation,
  useDiscardSimulationRun,
  usePromoteSimulationRun,
  type ScenarioCatalogItem,
  type SimulationRun,
} from '@/api/simulation';
import ScenarioCard from '@/components/simulation/ScenarioCard';
import ParamsForm from '@/components/simulation/ParamsForm';
import ResultPanel from '@/components/simulation/ResultPanel';
import HistoryList from '@/components/simulation/HistoryList';

export default function SimulationPage() {
  const navigate = useNavigate();

  const { data: catalog = [], isLoading: catalogLoading } = useSimulationCatalog();
  const { data: history = [], isLoading: historyLoading, refetch: refreshHistory } = useSimulationHistory(30);
  const runSimulation = useRunSimulation();
  const discardRun = useDiscardSimulationRun();
  const promoteRun = usePromoteSimulationRun();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paramsDraft, setParamsDraft] = useState<Record<string, unknown>>({});
  const [activeRun, setActiveRun] = useState<SimulationRun | null>(null);

  const scenario = catalog.find((s: ScenarioCatalogItem) => s.key === selectedKey) || null;

  const onSelectScenario = (key: string) => {
    setSelectedKey(key);
    setParamsDraft({});
    setActiveRun(null);
  };

  const onRun = async () => {
    if (!scenario) return;
    const run = await runSimulation.mutateAsync({
      scenario_key: scenario.key,
      params: paramsDraft,
    });
    setActiveRun(run);
  };

  const onPromote = async () => {
    if (!activeRun) return;
    await promoteRun.mutateAsync(activeRun.id);
    navigate('/mission-control');
  };

  const onDiscard = async () => {
    if (!activeRun) return;
    await discardRun.mutateAsync(activeRun.id);
    setActiveRun(null);
  };

  const onShowRun = (id: string) => {
    const run = history.find((r: SimulationRun) => r.id === id);
    if (run) setActiveRun(run);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Compass className="h-3 w-3" />
            Mode Simulation
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Projetez l'impact d'une décision stratégique
          </h1>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Choisissez un scénario, ajustez quelques paramètres et obtenez une synthèse{' '}
            <strong>cabinet de conseil</strong> : opportunités, risques, impacts, charge à
            prévoir, ROI probable, maturité requise.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshHistory()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir l'historique
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Colonne principale */}
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              1. Quelle décision voulez-vous projeter ?
            </h2>
            {catalogLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {catalog.map((sc: ScenarioCatalogItem) => (
                  <ScenarioCard
                    key={sc.key}
                    scenario={sc}
                    active={sc.key === selectedKey}
                    onSelect={onSelectScenario}
                  />
                ))}
              </div>
            )}
          </section>

          {scenario && (
            <section className="rounded-2xl border border-border bg-card/85 px-5 py-5 shadow-sm">
              <h2 className="mb-1 inline-flex items-center gap-2 text-[14px] font-semibold text-foreground">
                2. Précisez le contexte
              </h2>
              <p className="mb-3 text-[12.5px] text-muted-foreground">{scenario.description}</p>
              {scenario.hints.length > 0 && (
                <ul className="mb-4 space-y-1">
                  {scenario.hints.map((h: string, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground"
                    >
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
              <ParamsForm
                scenario={scenario}
                values={paramsDraft}
                onChange={(key, value) => setParamsDraft((prev) => ({ ...prev, [key]: value }))}
                onRun={onRun}
                running={runSimulation.isPending}
              />
            </section>
          )}

          {activeRun && (
            <section>
              <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-foreground">
                3. Synthèse stratégique
              </h2>
              <ResultPanel
                result={activeRun.result}
                onPromote={onPromote}
                onDiscard={onDiscard}
                promoting={promoteRun.isPending}
              />
            </section>
          )}
        </div>

        {/* Sidebar Historique */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 inline-flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
            Historique
            <span className="text-[11px] font-normal text-muted-foreground">
              ({history.length})
            </span>
          </h2>
          {historyLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <HistoryList
              items={history}
              activeId={activeRun?.id}
              onSelect={onShowRun}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
