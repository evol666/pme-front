import { Check } from 'lucide-react';
import type { StepDef } from '@/api/onboarding';

type Props = {
  readonly steps: StepDef[];
  readonly current: number; // 1-based
};

// Classe du cercle d'étape selon son état — table de correspondance plutôt
// que ternaires imbriquées.
function stepCircleClass(done: boolean, active: boolean): string {
  if (done) return 'bg-emerald-500 text-white';
  if (active) return 'bg-primary text-primary-foreground ring-4 ring-primary/20';
  return 'bg-muted text-muted-foreground';
}

// Classe du libellé d'étape selon son état — table de correspondance plutôt
// que ternaires imbriquées.
function stepLabelClass(active: boolean, done: boolean): string {
  if (active) return 'text-foreground';
  if (done) return 'text-emerald-700';
  return 'text-muted-foreground';
}

export default function ProgressStepper({ steps, current }: Props) {
  return (
    <nav aria-label="Progression" className="w-full">
      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((step, idx) => {
          const done = step.number < current;
          const active = step.number === current;
          const last = idx === steps.length - 1;
          return (
            <li key={step.key} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    stepCircleClass(done, active),
                  ].join(' ')}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : step.number}
                </span>
                <span
                  className={[
                    'hidden text-sm font-medium md:inline',
                    stepLabelClass(active, done),
                  ].join(' ')}
                >
                  {step.title}
                </span>
              </div>
              {!last && (
                <span
                  className={[
                    'mx-1 h-0.5 flex-1 rounded-full transition-colors sm:mx-2',
                    done ? 'bg-emerald-400' : 'bg-border',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
