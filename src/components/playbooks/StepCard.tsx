import { useState } from 'react';
import {
  Check,
  ChevronRight,
  CircleSlash,
  Edit3,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Link } from "react-router";
import type { StepState, StepStatus } from '@/api/playbooks';

const KIND_LABEL: Record<string, string> = {
  action: 'Action',
  module: 'Module',
  workflow: 'Workflow',
  recommendation: 'Recommandation',
  question: 'Question stratégique',
};

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'À faire',
  in_progress: 'En cours',
  done: 'Fait',
  skipped: 'Ignoré',
  blocked: 'Bloqué',
};

// Classes dépendant du statut — table de correspondance plutôt que ternaires
// imbriquées (statuts non listés retombent sur le style par défaut).
const BORDER_CLASS_BY_STATUS: Partial<Record<StepStatus, string>> = {
  done: 'border-emerald-200 bg-emerald-50/40',
  skipped: 'border-border bg-muted/20 opacity-70',
  in_progress: 'border-primary/30 bg-primary/5',
};
const DEFAULT_BORDER_CLASS = 'border-border bg-card';

const INDICATOR_CLASS_BY_STATUS: Partial<Record<StepStatus, string>> = {
  done: 'bg-emerald-500 text-white',
  skipped: 'bg-muted-foreground/40 text-white',
  in_progress: 'bg-primary text-primary-foreground',
};
const DEFAULT_INDICATOR_CLASS = 'bg-muted text-muted-foreground';

type Props = {
  readonly step: StepState;
  readonly position: number;
  readonly saving?: boolean;
  readonly onStatusChange: (status: StepStatus) => void;
  readonly onSaveNote: (note: string | null) => void;
};

export default function StepCard({ step, position, saving, onStatusChange, onSaveNote }: Props) {
  const done = step.status === 'done';
  const inProgress = step.status === 'in_progress';

  const borderClass = BORDER_CLASS_BY_STATUS[step.status] ?? DEFAULT_BORDER_CLASS;
  const indicatorClass = INDICATOR_CLASS_BY_STATUS[step.status] ?? DEFAULT_INDICATOR_CLASS;

  const linkHref = stepActionHref(step);
  const linkLabel = stepActionLabel(step);

  return (
    <article className={`relative rounded-2xl border ${borderClass} px-4 py-4 shadow-sm`}>
      <header className="flex items-start gap-3">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${indicatorClass}`}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : position}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {KIND_LABEL[step.kind] || step.kind}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {STATUS_LABEL[step.status] || step.status}
              {step.est_duration && ` · ${step.est_duration}`}
              {!step.required && ' · optionnelle'}
            </span>
          </div>
          <h3 className="mt-1 text-[14.5px] font-semibold text-foreground">{step.label}</h3>
          {step.description && (
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              {step.description}
            </p>
          )}
          {step.automation_hint && (
            <p className="mt-1.5 inline-flex items-start gap-1 text-[11.5px] leading-snug text-primary">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2.4} />
              <span>{step.automation_hint}</span>
            </p>
          )}
        </div>
      </header>

      {linkHref && (
        <div className="mt-3">
          <Link
            to={linkHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {linkLabel}
          </Link>
        </div>
      )}

      <StepNoteEditor step={step} onSaveNote={onSaveNote} />

      <StepFooterActions
        done={done}
        inProgress={inProgress}
        saving={saving}
        onStatusChange={onStatusChange}
      />
    </article>
  );
}

// Zone de note : édition inline (textarea) ou affichage / bouton d'ajout.
// Extraite du composant principal pour garder StepCard sous le seuil de
// complexité cognitive autorisé.
function StepNoteEditor({
  step,
  onSaveNote,
}: {
  readonly step: StepState;
  readonly onSaveNote: (note: string | null) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(step.note || '');

  if (editingNote) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <div className="flex flex-col gap-2">
          <textarea
            rows={2}
            value={draftNote}
            maxLength={2000}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Notes, décisions, contexte…"
            className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-[12.5px] text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingNote(false);
                setDraftNote(step.note || '');
              }}
              className="text-[11.5px] text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveNote(draftNote.trim() ? draftNote.trim() : null);
                setEditingNote(false);
              }}
              className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step.note) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => {
            setEditingNote(true);
            setDraftNote(step.note || '');
          }}
          className="group flex w-full items-start gap-2 text-left"
        >
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-[12px] leading-snug text-foreground">{step.note}</span>
          <Edit3 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => {
          setEditingNote(true);
          setDraftNote('');
        }}
        className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="h-3 w-3" />
        Ajouter une note
      </button>
    </div>
  );
}

// Actions de pied de carte (démarrer / sauter / marquer fait / rouvrir).
// Extraites du composant principal pour réduire la complexité cognitive.
function StepFooterActions({
  done,
  inProgress,
  saving,
  onStatusChange,
}: {
  readonly done: boolean;
  readonly inProgress: boolean;
  readonly saving?: boolean;
  readonly onStatusChange: (status: StepStatus) => void;
}) {
  if (done) {
    return (
      <footer className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onStatusChange('in_progress')}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          Rouvrir
        </button>
      </footer>
    );
  }

  return (
    <footer className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
      {!inProgress && (
        <button
          type="button"
          onClick={() => onStatusChange('in_progress')}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <Loader2 className="h-3 w-3" />
          Démarrer
        </button>
      )}
      <button
        type="button"
        onClick={() => onStatusChange('skipped')}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        <CircleSlash className="h-3 w-3" />
        Sauter
      </button>
      <button
        type="button"
        onClick={() => onStatusChange('done')}
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Check className="h-3 w-3" strokeWidth={2.6} />
        Marquer fait
        <ChevronRight className="h-3 w-3" />
      </button>
    </footer>
  );
}

function stepActionHref(step: StepState): string | null {
  if (step.kind === 'module' && step.module_id)
    return `/documents?module=${encodeURIComponent(step.module_id)}`;
  if (step.kind === 'workflow' && step.workflow_id)
    return `/workflows?focus=${encodeURIComponent(step.workflow_id)}`;
  if (step.kind === 'recommendation') return '/recommandations';
  return null;
}

function stepActionLabel(step: StepState): string {
  switch (step.kind) {
    case 'module':
      return 'Ouvrir le module';
    case 'workflow':
      return 'Lancer le workflow';
    case 'recommendation':
      return 'Voir les recommandations';
    default:
      return 'Ouvrir';
  }
}
