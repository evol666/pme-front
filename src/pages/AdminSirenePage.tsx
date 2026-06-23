import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import {
  startSireneImport,
  getSireneImportStatus,
  getSireneStats,
} from "@/api/portefeuilleImport";
import { cn } from "@/lib/utils";

/**
 * Page admin — import de la base Sirene complète (StockUniteLegale INSEE).
 * Accessible sur /admin-sirene, visible ROLE_ADMIN seulement.
 */
export default function AdminSirenePage() {
  const [stats, setStats] = useState<{ actives: number; cessees: number; total: number } | null>(null);
  const [status, setStatus] = useState<{
    running: boolean; phase: string; processed: number;
    upserted: number; skipped: number; error: string | null;
    startedAt: string | null; finishedAt: string | null;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);

  async function loadStats() {
    try { setStats(await getSireneStats()); } catch {}
  }

  async function loadStatus() {
    try { setStatus(await getSireneImportStatus()); } catch {}
  }

  useEffect(() => {
    loadStats();
    loadStatus();
  }, []);

  // Polling automatique pendant l'import
  useEffect(() => {
    if (!status?.running) { setPolling(false); return; }
    setPolling(true);
    const t = setInterval(async () => {
      await loadStatus();
      await loadStats();
    }, 3000);
    return () => clearInterval(t);
  }, [status?.running]);

  async function handleStart() {
    setStarting(true);
    try {
      await startSireneImport();
      await loadStatus();
    } finally {
      setStarting(false);
    }
  }

  const phase = status?.phase ?? "idle";
  const isRunning = status?.running ?? false;

  const PHASE_LABEL: Record<string, string> = {
    idle:        "Inactif",
    downloading: "Téléchargement du fichier Sirene…",
    parsing:     "Parsing et import en base…",
    done:        "Import terminé",
    error:       "Erreur",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Administration</p>
        <h1 className="text-2xl font-extrabold text-foreground mt-0.5">Base Sirene INSEE</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import mensuel du fichier StockUniteLegale (~12M entreprises françaises). Permet la recherche par SIREN ou nom dans le wizard d'ajout.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Actives",  value: stats?.actives, color: "emerald" },
          { label: "Cessées",  value: stats?.cessees, color: "amber" },
          { label: "Total",    value: stats?.total,   color: "primary" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm text-center">
            <p className={cn(
              "text-3xl font-extrabold",
              s.color === "emerald" ? "text-emerald-600" :
              s.color === "amber"   ? "text-amber-500" :
              "text-foreground",
            )}>
              {s.value != null ? s.value.toLocaleString("fr-FR") : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Statut import */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Import Sirene</h2>
          </div>
          <button
            onClick={async () => { await loadStatus(); await loadStats(); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", polling && "animate-spin")} />
          </button>
        </div>

        {/* Phase */}
        <div className={cn(
          "flex items-center gap-3 p-4 rounded-xl",
          phase === "done"  ? "bg-emerald-500/8 border border-emerald-500/20" :
          phase === "error" ? "bg-red-500/8 border border-red-500/20" :
          isRunning         ? "bg-primary/8 border border-primary/20" :
          "bg-muted/30 border border-border/40",
        )}>
          {isRunning ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
          ) : phase === "done" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : phase === "error" ? (
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          ) : (
            <Database className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{PHASE_LABEL[phase] ?? phase}</p>
            {status?.error && (
              <p className="text-xs text-red-600 mt-0.5">{status.error}</p>
            )}
          </div>
        </div>

        {/* Progression */}
        {status && (isRunning || phase === "done") && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Lignes traitées",   value: status.processed.toLocaleString("fr-FR") },
                { label: "Insérées/mises à j.", value: status.upserted.toLocaleString("fr-FR") },
                { label: "Ignorées",           value: status.skipped.toLocaleString("fr-FR") },
              ].map((m) => (
                <div key={m.label} className="bg-muted/30 rounded-xl p-3">
                  <p className="text-lg font-bold text-foreground">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {isRunning && status.processed > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progression estimée</span>
                  <span>{Math.round((status.processed / 12_000_000) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((status.processed / 12_000_000) * 100, 99)}%` }}
                  />
                </div>
              </div>
            )}

            {status.startedAt && (
              <p className="text-xs text-muted-foreground">
                Démarré le {new Date(status.startedAt).toLocaleString("fr-FR")}
                {status.finishedAt && <> · Terminé le {new Date(status.finishedAt).toLocaleString("fr-FR")}</>}
              </p>
            )}
          </div>
        )}

        {/* Bouton démarrer */}
        <div className="flex gap-3 pt-2 border-t border-border/40">
          <button
            onClick={handleStart}
            disabled={isRunning || starting}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              isRunning || starting
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
            )}
          >
            {starting || isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? "Import en cours…" : "Lancer l'import Sirene"}
          </button>

          <button
            onClick={async () => {
              const a = document.createElement("a");
              a.href = "https://www.data.gouv.fr/fr/datasets/r/825f4199-cadd-486c-ac46-a65a8ea1a047";
              a.target = "_blank";
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-accent transition-colors"
          >
            <Download className="w-4 h-4" />
            Source data.gouv.fr
          </button>
        </div>

        <div className="p-3 bg-amber-500/8 rounded-xl border border-amber-500/20 text-xs text-muted-foreground">
          <strong className="text-foreground">⚠ Durée estimée :</strong> 15–30 minutes selon la connexion et le serveur. L'import tourne en arrière-plan et ne bloque pas l'application. Relancer la page pour voir la progression.
        </div>
      </div>
    </div>
  );
}
