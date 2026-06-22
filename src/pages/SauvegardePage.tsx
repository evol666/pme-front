/**
 * SauvegardePage — Export & Snapshots (Administration > Sauvegarde).
 *
 * Permet à l'administrateur de :
 *   1. Exporter les données de la plateforme au format PDF ou DOCX.
 *   2. Consulter l'historique des snapshots KPI (agrégats périodiques).
 *   3. Consulter l'historique des snapshots de timeline.
 *   4. Déclencher manuellement un snapshot KPI ou timeline.
 *
 * Endpoints Spring Boot : /api/export, /api/kpi-snapshots, /api/timeline-snapshots.
 * Aucune dépendance FastAPI.
 */
import { useState } from "react";
import {
  Archive,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Plus,
  RefreshCw,
  Shield,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import {
  useExportData,
  useKpiSnapshots,
  useTimelineSnapshots,
  useCreateTimelineSnapshot,
} from "@/api/sauvegarde";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Section Export ───────────────────────────────────────────────────────────

function ExportSection() {
  const exportPdf = useExportData("pdf");
  const exportDocx = useExportData("docx");

  const demoPayload = {
    proposition: {
      executiveSummary: "Synthèse export PME",
      contextAnalysis: "Contexte global de la plateforme",
      recommendations: [],
      actionPlan: [],
      expectedBenefits: "Archivage des données stratégiques",
      nextSteps: "Vérifier les exports périodiquement",
    },
    meta: { company_name: "Mon Entreprise", metier_label: "PME" },
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Export de données</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Téléchargez un récapitulatif de la plateforme au format de votre choix.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={exportPdf.isPending}
          onClick={() => exportPdf.mutate(demoPayload)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          {exportPdf.isPending ? "Génération PDF…" : "Export PDF"}
        </button>
        <button
          type="button"
          disabled={exportDocx.isPending}
          onClick={() => exportDocx.mutate(demoPayload)}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileText className="h-4 w-4" />
          {exportDocx.isPending ? "Génération DOCX…" : "Export DOCX"}
        </button>
      </div>
      {(exportPdf.isError || exportDocx.isError) && (
        <p className="mt-3 text-xs text-destructive">
          Erreur lors de l'export. Vérifiez que la plateforme est disponible.
        </p>
      )}
    </div>
  );
}

// ─── Section KPI Snapshots ────────────────────────────────────────────────────

function KpiSnapshotsSection() {
  const { data: snapshots = [], isLoading, refetch } = useKpiSnapshots();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Snapshots KPI
            {snapshots.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                {snapshots.length}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void refetch();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Actualiser"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Chargement…</p>
          ) : snapshots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucun snapshot KPI enregistré.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">KPI</th>
                    <th className="pb-2 pr-4 font-medium">Granularité</th>
                    <th className="pb-2 pr-4 font-medium">Période</th>
                    <th className="pb-2 pr-4 font-medium text-right">Valeur</th>
                    <th className="pb-2 font-medium text-right">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {snapshots.slice(0, 10).map((s) => {
                    const delta =
                      s.valuePrev !== undefined && s.valuePrev !== null
                        ? ((s.value - s.valuePrev) / Math.abs(s.valuePrev)) * 100
                        : null;
                    return (
                      <tr key={s.id} className="text-foreground">
                        <td className="py-2 pr-4 font-mono font-medium">{s.kpi}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{s.granularity}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {fmtDate(s.periodStart)} → {fmtDate(s.periodEnd)}
                        </td>
                        <td className="py-2 pr-4 text-right font-medium">
                          {s.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 text-right">
                          {delta !== null ? (
                            <span
                              className={
                                delta >= 0 ? "text-emerald-600" : "text-destructive"
                              }
                            >
                              {delta >= 0 ? "+" : ""}
                              {delta.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {snapshots.length > 10 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {snapshots.length - 10} entrées supplémentaires non affichées.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Timeline Snapshots ───────────────────────────────────────────────

function TimelineSnapshotsSection() {
  const { data: snapshots = [], isLoading, refetch } = useTimelineSnapshots();
  const createSnapshot = useCreateTimelineSnapshot();
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState("");
  const [highlights, setHighlights] = useState("");

  const handleCreate = async () => {
    if (!period.trim()) return;
    await createSnapshot.mutateAsync({ period: period.trim(), highlights: highlights.trim() });
    setPeriod("");
    setHighlights("");
    setShowForm(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Snapshots de timeline
            {snapshots.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                {snapshots.length}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void refetch();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Actualiser"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau snapshot
            </button>
          </div>

          {showForm && (
            <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Période <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="ex: 2024-Q1, juin 2025…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Points clés (optionnel)
                </label>
                <textarea
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  rows={2}
                  placeholder="Principaux faits marquants de la période…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!period.trim() || createSnapshot.isPending}
                  onClick={handleCreate}
                  className="rounded-xl bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  {createSnapshot.isPending ? "Enregistrement…" : "Créer"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Chargement…</p>
          ) : snapshots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <TimerReset className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucun snapshot de timeline disponible.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3"
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.period}</p>
                    {s.highlights && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {s.highlights}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Créé le {fmtDateTime(s.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function SauvegardePage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Archive className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sauvegarde & export</h1>
          <p className="text-sm text-muted-foreground">
            Exportez vos données et consultez l'historique des snapshots KPI et de timeline.
          </p>
        </div>
      </header>

      {/* Bandeau info */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-foreground/80">
          Les exports contiennent les données de la proposition en cours. Les snapshots sont des
          agrégats calculés par le backend — ils ne contiennent pas de données personnelles.
        </p>
      </div>

      <ExportSection />
      <KpiSnapshotsSection />
      <TimelineSnapshotsSection />
    </div>
  );
}
