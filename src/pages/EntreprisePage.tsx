import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useEntreprise, useRefreshEntreprise, type BodaccSignal, type ScoreAxe } from "@/api/entreprises";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function EntreprisePage() {
  const { siren } = useParams<{ siren: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useEntreprise(siren);
  const refresh = useRefreshEntreprise();

  if (!siren || !/^\d{9}$/.test(siren)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-muted-foreground">
        <AlertTriangle className="w-8 h-8" />
        <p className="text-sm">SIREN invalide : {siren}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm">Enrichissement en cours pour {siren}…</p>
        <p className="text-xs">Recherche d'Entreprises · BODACC · Géocodage</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-medium">Impossible d'enrichir ce SIREN</p>
        <p className="text-xs">{String((error as Error)?.message ?? "Erreur inconnue")}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      </div>
    );
  }

  const { identite, scoring, bodacc, geolocalisation, synthese } = data;
  const isActif = identite.statut === "actif";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      {/* En-tête entreprise */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-extrabold text-foreground truncate">
                {identite.raison_sociale ?? identite.enseigne ?? siren}
              </h1>
              <StatusBadge statut={identite.statut} />
              {identite.categorie && (
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">
                  {identite.categorie}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
              <span className="font-mono font-semibold text-foreground">{siren}</span>
              {identite.code_naf && (
                <span>{identite.code_naf} · {identite.libelle_naf}</span>
              )}
              {(identite.ville || identite.code_postal) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[identite.adresse, identite.code_postal, identite.ville].filter(Boolean).join(", ")}
                </span>
              )}
              {identite.date_creation && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Créée le {new Date(identite.date_creation).toLocaleDateString("fr-FR")}
                  {" "}({synthese.points_cles.anciennete_ans} an{synthese.points_cles.anciennete_ans > 1 ? "s" : ""})
                </span>
              )}
            </div>

            {identite.convention_collective && (
              <p className="mt-2 text-xs text-muted-foreground">
                📋 {identite.convention_collective}
              </p>
            )}
          </div>

          {/* Score + refresh */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <ScoreCircle score={scoring.score_global} severity={scoring.severity} />
            <button
              onClick={() => refresh.mutate(siren)}
              disabled={refresh.isPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Forcer le re-enrichissement"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refresh.isPending && "animate-spin")} />
              {refresh.isPending ? "Actualisation…" : "Actualiser"}
            </button>
          </div>
        </div>
      </div>

      {/* Grille 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          <ScoreSection scoring={scoring} />
          <BodaccSection bodacc={bodacc} />
          {identite.dirigeants.length > 0 && (
            <DirigeantsSection dirigeants={identite.dirigeants} />
          )}
        </div>

        {/* Colonne secondaire */}
        <div className="space-y-6">
          <IdentiteSection identite={identite} />
          {geolocalisation && <GeoSection geo={geolocalisation} identite={identite} />}
        </div>
      </div>

      {/* Synthèse textuelle */}
      <div className="bg-muted/30 border border-border/40 rounded-xl px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Synthèse</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{synthese.texte}</p>
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Enrichi le {new Date(data.enriched_at).toLocaleString("fr-FR")} · Source : {identite.source}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function StatusBadge({ statut }: { statut: string }) {
  const isActif = statut === "actif";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
      isActif ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
    )}>
      {isActif
        ? <CheckCircle2 className="w-3 h-3" />
        : <Clock className="w-3 h-3" />}
      {isActif ? "Actif" : "Cessé"}
    </span>
  );
}

function ScoreCircle({ score, severity }: { score: number; severity: string }) {
  const color =
    severity === "faible" ? "text-emerald-600" :
    severity === "modéré" ? "text-amber-500" :
    "text-red-500";

  const bg =
    severity === "faible" ? "bg-emerald-500/10" :
    severity === "modéré" ? "bg-amber-500/10" :
    "bg-red-500/10";

  return (
    <div className={cn("w-16 h-16 rounded-2xl flex flex-col items-center justify-center", bg)}>
      <span className={cn("text-2xl font-extrabold leading-none", color)}>{score}</span>
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">/100</span>
    </div>
  );
}

// Score 5 axes
const AXE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  stabilite:          { label: "Stabilité",          icon: Calendar },
  croissance:         { label: "Croissance",          icon: TrendingUp },
  risque:             { label: "Risque",              icon: AlertTriangle },
  maturite_naf:       { label: "Maturité NAF",        icon: FileText },
  solidite_dirigeants:{ label: "Solidité dirigeants", icon: Users },
};

function ScoreSection({ scoring }: { scoring: import("@/api/entreprises").Scoring }) {
  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Score PME Platform</h2>
        <span className="ml-auto text-2xl font-extrabold text-foreground">{scoring.score_global}<span className="text-base text-muted-foreground font-normal">/100</span></span>
      </div>

      <div className="space-y-3">
        {Object.entries(scoring.axes).map(([key, axe]) => (
          <AxeRow key={key} axeKey={key} axe={axe} />
        ))}
      </div>
    </section>
  );
}

function AxeRow({ axeKey, axe }: { axeKey: string; axe: ScoreAxe }) {
  const [expanded, setExpanded] = useState(false);
  const meta = AXE_LABELS[axeKey] ?? { label: axeKey, icon: Zap };
  const Icon = meta.icon;

  const barColor =
    axe.score >= 70 ? "bg-emerald-500" :
    axe.score >= 40 ? "bg-amber-400" :
    "bg-red-400";

  return (
    <div>
      <button
        onClick={() => axe.raisons.length > 0 && setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-3 text-left group",
          axe.raisons.length > 0 && "cursor-pointer",
        )}
      >
        <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium text-foreground w-36 flex-shrink-0">{meta.label}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${axe.score}%` }}
          />
        </div>
        <span className="text-xs font-bold text-foreground w-8 text-right">{axe.score}</span>
        {axe.raisons.length > 0 && (
          expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {expanded && axe.raisons.length > 0 && (
        <ul className="mt-1.5 ml-8 space-y-0.5">
          {axe.raisons.map((r, i) => (
            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="text-primary mt-0.5">·</span> {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BodaccSection({ bodacc }: { bodacc: import("@/api/entreprises").BodaccData }) {
  const [showAll, setShowAll] = useState(false);
  const { signaux, evenements } = bodacc;
  const visible = showAll ? evenements : evenements.slice(0, 5);

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">BODACC</h2>
        <span className="ml-2 text-xs text-muted-foreground">{signaux.total} événements</span>
        <div className="ml-auto flex gap-2">
          {signaux.risque > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-xs font-bold">
              ⚠ {signaux.risque} risque{signaux.risque > 1 ? "s" : ""}
            </span>
          )}
          {signaux.croissance > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
              ↑ {signaux.croissance} croissance
            </span>
          )}
          {signaux.risque === 0 && signaux.croissance === 0 && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
              Aucun signal
            </span>
          )}
        </div>
      </div>

      {evenements.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun événement BODACC trouvé.</p>
      ) : (
        <>
          <div className="space-y-1">
            {visible.map((ev, i) => <BodaccRow key={i} ev={ev} signaux={signaux} />)}
          </div>
          {evenements.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
            >
              {showAll
                ? <><ChevronUp className="w-3.5 h-3.5" /> Réduire</>
                : <><ChevronDown className="w-3.5 h-3.5" /> Voir les {evenements.length - 5} autres</>}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function BodaccRow({ ev, signaux }: { ev: BodaccSignal; signaux: any }) {
  const isRisque = signaux.evenements_risque.some((r: BodaccSignal) => r.numero === ev.numero);
  const isCroissance = signaux.evenements_croissance.some((c: BodaccSignal) => c.numero === ev.numero);

  return (
    <div className={cn(
      "flex items-start gap-3 px-3 py-2 rounded-lg text-xs",
      isRisque ? "bg-red-500/5" : isCroissance ? "bg-emerald-500/5" : "bg-muted/30",
    )}>
      <span className="text-muted-foreground w-20 flex-shrink-0 pt-0.5">
        {new Date(ev.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}
      </span>
      <span className={cn(
        "font-medium flex-shrink-0",
        isRisque ? "text-red-600" : isCroissance ? "text-emerald-600" : "text-foreground",
      )}>
        {ev.type}
      </span>
      <span className="text-muted-foreground truncate">{ev.tribunal.replace("Greffe du Tribunal", "TC").replace("GREFFE DU TRIBUNAL", "TC")}</span>
    </div>
  );
}

function DirigeantsSection({ dirigeants }: { dirigeants: import("@/api/entreprises").Dirigeant[] }) {
  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Dirigeants</h2>
      </div>
      <div className="divide-y divide-border/50">
        {dirigeants.map((d, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {(d.prenoms?.[0] ?? d.nom?.[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {[d.prenoms, d.nom].filter(Boolean).join(" ") || "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{d.qualite}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IdentiteSection({ identite }: { identite: import("@/api/entreprises").Identite }) {
  const rows: Array<{ label: string; value: string | null | number | undefined }> = [
    { label: "SIREN",         value: identite.siren },
    { label: "SIRET siège",   value: identite.siret_siege },
    { label: "Forme juridique", value: identite.forme_juridique_libelle ?? identite.forme_juridique },
    { label: "Capital",       value: identite.capital_social != null ? `${identite.capital_social.toLocaleString("fr-FR")} €` : null },
    { label: "Effectif",      value: identite.effectif_tranche ? `Tranche ${identite.effectif_tranche}${identite.annee_effectif ? ` (${identite.annee_effectif})` : ""}` : null },
    { label: "Établissements", value: identite.nb_etablissements_ouverts != null ? String(identite.nb_etablissements_ouverts) : null },
    { label: "Risque sectoriel", value: identite.risque_sectoriel },
  ];

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Identité</h2>
      </div>
      <dl className="space-y-2">
        {rows.filter(r => r.value != null && r.value !== "").map(r => (
          <div key={r.label} className="flex justify-between gap-2 text-xs">
            <dt className="text-muted-foreground flex-shrink-0">{r.label}</dt>
            <dd className="font-medium text-foreground text-right truncate">{String(r.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GeoSection({ geo, identite }: {
  geo: import("@/api/entreprises").Geolocalisation;
  identite: import("@/api/entreprises").Identite;
}) {
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${geo.latitude}&mlon=${geo.longitude}&zoom=15`;

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Localisation</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{geo.label}</p>
      <div className="text-xs text-muted-foreground space-y-1 mb-3">
        <div className="flex justify-between">
          <span>Latitude</span><span className="font-mono">{geo.latitude.toFixed(5)}</span>
        </div>
        <div className="flex justify-between">
          <span>Longitude</span><span className="font-mono">{geo.longitude.toFixed(5)}</span>
        </div>
        <div className="flex justify-between">
          <span>Code INSEE</span><span className="font-mono">{geo.code_insee}</span>
        </div>
        <div className="flex justify-between">
          <span>Fiabilité géocode</span>
          <span className={cn("font-bold", geo.score > 0.8 ? "text-emerald-600" : "text-amber-500")}>
            {Math.round(geo.score * 100)}%
          </span>
        </div>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="block text-center text-xs text-primary hover:underline"
      >
        Voir sur OpenStreetMap →
      </a>
    </section>
  );
}
