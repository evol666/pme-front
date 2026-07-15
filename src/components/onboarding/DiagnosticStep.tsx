import { useEffect, useState } from 'react';
import { Activity, Loader2, UserRound } from 'lucide-react';
import { useRunDiagnostic, type DiagnosticResult } from '@/api/onboarding';
import ScoreGauge from './ScoreGauge';

function Tags({ label, items }: { readonly label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DiagnosticStep() {
  const runDiagnostic = useRunDiagnostic();
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    if (!diagnostic && !runDiagnostic.isPending) {
      runDiagnostic.mutate(undefined, {
        onSuccess: (data) => setDiagnostic(data),
      });
    }
  }, [diagnostic, runDiagnostic]);

  if (runDiagnostic.isPending || !diagnostic) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">
          L'IA analyse votre entreprise…
        </p>
        <p className="text-xs text-muted-foreground">Maturité · profil · profil utilisateur</p>
      </div>
    );
  }

  const snap = diagnostic.maturity?.snapshot;
  const dims = snap?.dimensions || [];
  const profile = diagnostic.profile;
  const persona = diagnostic.persona;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Votre diagnostic</h2>
          <p className="text-sm text-muted-foreground">Un premier aperçu, en un coup d'œil.</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[auto,1fr]">
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-5">
          {snap ? (
            <ScoreGauge
              score={snap.global_score}
              level={snap.overall_level}
              caption="Maturité globale"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Maturité à évaluer</p>
          )}
        </div>

        <div className="space-y-4">
          {persona && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profil principal détecté</p>
                <p className="text-sm font-semibold text-foreground">{persona.label}</p>
              </div>
            </div>
          )}

          {dims.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Par dimension
              </p>
              <div className="space-y-2.5">
                {dims.slice(0, 6).map((d) => (
                  <div key={d.dimension_key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-foreground">
                      {d.dimension_label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(0, Math.min(100, d.score))}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-medium text-muted-foreground">
                      {Math.round(d.score)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(profile.offerings.length > 0 ||
        profile.targets.length > 0 ||
        profile.differentiators.length > 0) && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <Tags label="Offres" items={profile.offerings} />
          <Tags label="Cibles" items={profile.targets} />
          <Tags label="Différenciateurs" items={profile.differentiators} />
        </div>
      )}
    </div>
  );
}
