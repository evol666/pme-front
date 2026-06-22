import { Play } from 'lucide-react';
import type { ScenarioCatalogItem } from '@/api/simulation';

type Props = {
  scenario: ScenarioCatalogItem;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onRun: () => void;
  running?: boolean;
};

export default function ParamsForm({ scenario, values, onChange, onRun, running }: Props) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!running) onRun();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {scenario.param_fields.map((f) => {
          const val = values[f.key];
          const id = `sim-${scenario.key}-${f.key}`;
          const inputClass =
            'mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';
          return (
            <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label
                htmlFor={id}
                className="text-[11.5px] uppercase tracking-wide text-muted-foreground"
              >
                {f.label}
                {f.required && <span className="ml-1 text-amber-500">*</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  id={id}
                  rows={3}
                  value={(val as string) || ''}
                  placeholder={f.placeholder || ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              ) : f.type === 'select' ? (
                <select
                  id={id}
                  value={(val as string) || ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className={inputClass}
                >
                  {f.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : f.type === 'number' ? (
                <input
                  id={id}
                  type="number"
                  value={(val as number) ?? ''}
                  min={f.min ?? undefined}
                  max={f.max ?? undefined}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    onChange(f.key, Number.isNaN(n) ? null : n);
                  }}
                  className={inputClass}
                />
              ) : (
                <input
                  id={id}
                  type="text"
                  value={(val as string) || ''}
                  placeholder={f.placeholder || ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className={inputClass}
                />
              )}
              {f.help && (
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{f.help}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <p className="text-[11.5px] leading-snug text-muted-foreground">
          La simulation est une projection stratégique — pas une prévision comptable.
        </p>
        <button
          type="submit"
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
        >
          <Play className="h-3.5 w-3.5" strokeWidth={2.4} />
          {running ? 'Analyse en cours…' : 'Lancer la simulation'}
        </button>
      </div>
    </form>
  );
}
