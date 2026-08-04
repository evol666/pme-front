import { useNavigate } from "react-router";
import { FileText, FolderUp, ScrollText, Workflow } from 'lucide-react';

const DOC_TYPES = [
  { icon: FileText, label: 'Plaquettes' },
  { icon: ScrollText, label: 'Contrats' },
  { icon: Workflow, label: 'Procédures' },
  { icon: FolderUp, label: 'Documentation interne' },
];

export default function DocumentsStep() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600">
          <FolderUp className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Vos documents</h2>
          <p className="text-sm text-muted-foreground">
            Plus vous fournissez d'informations, plus l'IA sera pertinente.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/entreprises')}
        className="group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-primary shadow-sm transition-transform group-hover:scale-105">
          <FolderUp className="h-7 w-7" />
        </div>
        <span className="text-base font-semibold text-foreground">Déposer des documents</span>
        <span className="text-sm text-muted-foreground">
          Ouvre votre espace documents pour les importer
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DOC_TYPES.map((d) => {
          const Icon = d.icon;
          return (
            <div
              key={d.label}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">{d.label}</span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Cette étape est facultative — vous pourrez toujours ajouter des documents plus tard.
      </p>
    </div>
  );
}
