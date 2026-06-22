import { useEffect, useState } from 'react';
import { Check, Loader2, Wand2 } from 'lucide-react';
import {
  useOnboardingDeliverables,
  useGenerateDeliverable,
  type DeliverableResult,
} from '@/api/onboarding';
import { accentClasses, iconByName } from './ui';

export default function DeliverableStep() {
  const { data: deliverables = [], isLoading } = useOnboardingDeliverables();
  const generateDeliverable = useGenerateDeliverable();
  const [result, setResult] = useState<DeliverableResult | null>(null);

  const generate = (key: string) => {
    generateDeliverable.mutate(key, {
      onSuccess: (data) => setResult(data),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wand2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Votre premier livrable</h2>
          <p className="text-sm text-muted-foreground">Choisissez — l'IA s'occupe du reste.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {deliverables.map((d) => {
            const Icon = iconByName(d.icon);
            const ac = accentClasses(d.accent);
            const selected = result?.kind === d.key;
            return (
              <button
                key={d.key}
                type="button"
                disabled={generateDeliverable.isPending}
                onClick={() => generate(d.key)}
                className={[
                  'flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:shadow-sm disabled:opacity-60',
                  selected
                    ? `${ac.border} ring-2 ${ac.ring}`
                    : 'border-border',
                ].join(' ')}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ac.bg} ${ac.text}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {d.label}
                    {selected && <Check className="h-4 w-4 text-emerald-500" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {generateDeliverable.isPending && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Génération en cours…
        </div>
      )}

      {result && !generateDeliverable.isPending && (
        <div className="rounded-2xl border border-border bg-muted/30 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Aperçu — {result.label}
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
            {result.markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
