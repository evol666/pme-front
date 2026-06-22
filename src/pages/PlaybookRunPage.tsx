/**
 * PlaybookRunPage — LOT 31.
 *
 * Page détail d'un run : header + progression, liste d'étapes, sidebar
 * suggestions/stats.
 */
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Layers,
  Trash2,
} from 'lucide-react';
import {
  usePlaybookRun,
  usePlaybookIntelligence,
  usePatchPlaybookStep,
  useCompletePlaybookRun,
  useAbandonPlaybookRun,
  type StepStatus,
} from '@/api/playbooks';
import PlaybookProgress from '@/components/playbooks/PlaybookProgress';
import StepCard from '@/components/playbooks/StepCard';
import SuggestionsPanel from '@/components/playbooks/SuggestionsPanel';

export default function PlaybookRunPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: run, isLoading } = usePlaybookRun(id || null);
  const intelligence = usePlaybookIntelligence(run?.playbook_key ?? '');
  const patchStep = usePatchPlaybookStep();
  const completeRun = useCompletePlaybookRun();
  const abandonRun = useAbandonPlaybookRun();

  if (isLoading && !run) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3 text-[13px] text-amber-800">
          Run introuvable.
        </p>
        <button
          type="button"
          onClick={() => navigate('/playbooks')}
          className="mt-3 inline-flex items-center gap-1 text-[13px] text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux playbooks
        </button>
      </div>
    );
  }

  const isOpen = run.status === 'active';
  const alignPct =
    run.alignment_score != null
      ? Math.round(Math.max(0, Math.min(1, run.alignment_score)) * 100)
      : null;

  const onStepStatus = (stepKey: string, status: StepStatus) => {
    patchStep.mutate({ runId: run.id, stepKey, payload: { status } });
  };

  const onStepNote = (stepKey: string, note: string | null) => {
    patchStep.mutate({ runId: run.id, stepKey, payload: { note } });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <button
        type="button"
        onClick={() => navigate('/playbooks')}
        className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tous les playbooks
      </button>

      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-5 py-5 shadow-sm">
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
              <Layers className="h-3 w-3" />
              Playbook · {run.playbook_label}
            </p>
            <h1 className="mt-1 text-[20px] font-semibold text-foreground">
              {run.label || run.playbook_label}
            </h1>
            {run.mission_aligned_goal && alignPct != null && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
                <Compass className="h-3 w-3 text-primary" />
                Aligné avec « {run.mission_aligned_goal} » · {alignPct}%
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => abandonRun.mutate(run.id, { onSuccess: () => navigate('/playbooks') })}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-accent"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Abandonner
                </button>
                <button
                  type="button"
                  onClick={() => completeRun.mutate(run.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Clôturer
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />
                {run.status === 'completed' ? 'Terminé' : 'Abandonné'}
              </span>
            )}
          </div>
        </div>

        <div className="relative mt-4 max-w-md">
          <PlaybookProgress run={run} />
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          {run.steps.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step}
              position={idx + 1}
              saving={patchStep.isPending}
              onStatusChange={(status) => onStepStatus(step.step_key, status)}
              onSaveNote={(note) => onStepNote(step.step_key, note)}
            />
          ))}
        </section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 text-[13.5px] font-semibold text-foreground">
            Intelligence du playbook
          </h2>
          <SuggestionsPanel
            stats={intelligence.data?.stats ?? null}
            suggestions={intelligence.data?.suggestions ?? []}
          />
        </aside>
      </div>

      <footer className="mt-10 rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        Astuce : vos notes sur chaque étape alimentent l'analyse — l'IA proposera des
        améliorations contextualisées au fil de l'usage.
      </footer>
    </div>
  );
}
