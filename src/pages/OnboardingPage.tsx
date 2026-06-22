/**
 * OnboardingPage — LOT 38 (Onboarding Wizard).
 *
 * Assistant de premier démarrage en 5 étapes, ordre CORRIGÉ :
 *   1. Bienvenue       → WelcomeStep
 *   2. Diagnostic      → DiagnosticStep  (inversé vs ancien front)
 *   3. Documents       → DocumentsStep   (inversé vs ancien front)
 *   4. Premier livrable→ DeliverableStep
 *   5. Félicitations   → CompletionStep
 */
import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import {
  useOnboardingState,
  useStartOnboarding,
  useGoToStep,
  useCompleteOnboarding,
} from '@/api/onboarding';
import ProgressStepper from '@/components/onboarding/ProgressStepper';
import WelcomeStep from '@/components/onboarding/WelcomeStep';
import DiagnosticStep from '@/components/onboarding/DiagnosticStep';
import DocumentsStep from '@/components/onboarding/DocumentsStep';
import DeliverableStep from '@/components/onboarding/DeliverableStep';
import CompletionStep from '@/components/onboarding/CompletionStep';

export default function OnboardingPage() {
  const { data: state, isLoading } = useOnboardingState();
  const startOnboarding = useStartOnboarding();
  const goToStep = useGoToStep();
  const completeOnboarding = useCompleteOnboarding();

  // Démarre le parcours la première fois
  useEffect(() => {
    if (state && !state.onboarding_started_at && !state.onboarding_completed) {
      startOnboarding.mutate();
    }
  }, [state, startOnboarding]);

  if (isLoading || !state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const steps = state.steps || [];
  const current = Math.max(1, Math.min(steps.length || 5, state.onboarding_step || 1));
  const currentStep = steps.find((s) => s.number === current);
  const isLast = current >= (steps.length || 5);

  const next = async () => {
    if (current >= (steps.length || 5)) return;
    if (current + 1 >= (steps.length || 5)) {
      await completeOnboarding.mutateAsync();
    }
    await goToStep.mutateAsync(current + 1);
  };

  const prev = async () => {
    if (current <= 1) return;
    await goToStep.mutateAsync(current - 1);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Progression */}
      <div className="mb-8">
        <ProgressStepper steps={steps} current={current} />
      </div>

      {/* Carte de l'étape courante */}
      <div className="bg-card border border-border/50 rounded-2xl p-6">
        {current === 1 && <WelcomeStep />}
        {current === 2 && <DiagnosticStep />}
        {current === 3 && <DocumentsStep />}
        {current === 4 && <DeliverableStep />}
        {current === 5 && <CompletionStep summary={state.summary ?? null} />}
      </div>

      {/* Navigation (masquée sur la dernière étape) */}
      {!isLast && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void prev()}
            disabled={current <= 1 || goToStep.isPending}
            className="text-muted-foreground hover:bg-accent px-4 py-2 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>

          <button
            type="button"
            onClick={() => void next()}
            disabled={goToStep.isPending || completeOnboarding.isPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium inline-flex items-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {currentStep?.cta ?? 'Continuer'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
