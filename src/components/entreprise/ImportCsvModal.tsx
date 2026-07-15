import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useImportCsv, downloadTemplate, type ImportReport } from "@/api/portefeuilleImport";
import { cn } from "@/lib/utils";

interface Props {
  readonly onClose: () => void;
  readonly onSuccess: (report: ImportReport) => void;
}

export function ImportCsvModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportCsv();

  function handleFile(f: File) {
    if (!f.name.endsWith(".csv") && f.type !== "text/csv") {
      alert("Le fichier doit être au format CSV.");
      return;
    }
    setFile(f);
    setReport(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleImport() {
    if (!file) return;
    const result = await importMutation.mutateAsync(file);
    setReport(result);
    if (result.imported > 0) onSuccess(result);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Importer des entreprises</h2>
              <p className="text-xs text-muted-foreground">CSV — siren, kind, notes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Template */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
            <div>
              <p className="text-xs font-semibold text-foreground">Template CSV</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Colonnes : siren, kind, notes
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </button>
          </div>

          {/* Format */}
          <div className="bg-muted/20 rounded-xl p-3 font-mono text-xs text-muted-foreground space-y-0.5">
            <p className="font-bold text-foreground">siren,kind,notes</p>
            <p>414056309,client,Contact salon Paris</p>
            <p>552032534,prospect,</p>
            <p>542101803,partenaire,Accord cadre 2024</p>
          </div>

          {/* Valeurs kind */}
          <div className="flex flex-wrap gap-1.5">
            {["client","prospect","partenaire","concurrent","fournisseur"].map(k => (
              <span key={k} className="px-2 py-0.5 bg-muted/40 rounded-md text-xs font-mono text-muted-foreground">{k}</span>
            ))}
          </div>

          {/* Zone de dépôt */}
          {!report && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                dragOver
                  ? "border-primary bg-primary/5"
                  : file
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {file ? (
                <>
                  <FileText className="w-8 h-8 text-emerald-600" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024).toFixed(1)} Ko — cliquer pour changer
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground/40" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Déposer le fichier CSV ici</p>
                    <p className="text-xs text-muted-foreground mt-0.5">ou cliquer pour parcourir</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Rapport */}
          {report && <ImportReportView report={report} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0 bg-muted/20">
          {report ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Fermer
            </button>
          ) : (
            <>
              <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Annuler
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importMutation.isPending}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors",
                  file && !importMutation.isPending
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {importMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Importer</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportReportView({ report }: { readonly report: ImportReport }) {
  return (
    <div className="space-y-3">
      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center p-3 bg-emerald-500/10 rounded-xl">
          <span className="text-2xl font-extrabold text-emerald-600">{report.imported}</span>
          <span className="text-xs text-muted-foreground mt-0.5">Importées</span>
        </div>
        <div className="flex flex-col items-center p-3 bg-muted/30 rounded-xl">
          <span className="text-2xl font-extrabold text-foreground">{report.skipped}</span>
          <span className="text-xs text-muted-foreground mt-0.5">Ignorées</span>
        </div>
        <div className="flex flex-col items-center p-3 bg-red-500/10 rounded-xl">
          <span className="text-2xl font-extrabold text-red-600">{report.errors.length}</span>
          <span className="text-xs text-muted-foreground mt-0.5">Erreurs</span>
        </div>
      </div>

      {/* Succès */}
      {report.imported > 0 && (
        <div className="flex items-start gap-2 p-3 bg-emerald-500/8 rounded-xl border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{report.imported} entreprise{report.imported > 1 ? "s" : ""}</strong> ajoutée{report.imported > 1 ? "s" : ""} au portefeuille et enrichie{report.imported > 1 ? "s" : ""} automatiquement.
          </p>
        </div>
      )}

      {/* Ignorées */}
      {report.skipped > 0 && (
        <div className="p-3 bg-muted/30 rounded-xl">
          <p className="text-xs font-semibold text-foreground mb-1">{report.skipped} doublon{report.skipped > 1 ? "s" : ""} ignoré{report.skipped > 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground">{report.skippedSirens.slice(0, 5).join(", ")}{report.skippedSirens.length > 5 ? "…" : ""}</p>
        </div>
      )}

      {/* Erreurs */}
      {report.errors.length > 0 && (
        <div className="p-3 bg-red-500/8 rounded-xl border border-red-500/20 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <p className="text-xs font-semibold text-red-600">{report.errors.length} erreur{report.errors.length > 1 ? "s" : ""}</p>
          </div>
          {report.errors.slice(0, 5).map((e) => (
            <div key={e.line} className="text-xs text-muted-foreground">
              <span className="font-mono text-foreground">Ligne {e.line}</span> — {e.message}
            </div>
          ))}
          {report.errors.length > 5 && (
            <p className="text-xs text-muted-foreground">…et {report.errors.length - 5} autre{report.errors.length - 5 > 1 ? "s" : ""}</p>
          )}
        </div>
      )}
    </div>
  );
}
