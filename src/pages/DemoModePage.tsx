/**
 * DemoModePage — Mode Présentation Client (/demo).
 *
 * Écran permettant à un commercial / consultant de préparer une
 * démonstration de la plateforme PME :
 *   1. Activer / désactiver le mode présentation (masque les données
 *      sensibles dans le header et la sidebar).
 *   2. Parcours guidé : liste des modules clés avec lien direct.
 *   3. Checklist pré-démo : points à vérifier avant de commencer.
 *
 * Totalement client-side — aucun endpoint FastAPI.
 * Le flag "demoMode" est stocké dans sessionStorage (dure le temps
 * de l'onglet, pas de pollution entre sessions).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cpu,
  Eye,
  EyeOff,
  FileText,
  Globe,
  LayoutDashboard,
  Lightbulb,
  MonitorPlay,
  Network,
  PieChart,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DemoModule {
  key: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  path: string;
  category: "core" | "ia" | "admin";
}

interface ChecklistItem {
  id: string;
  label: string;
}

// ─── Données statiques ────────────────────────────────────────────────────────

const DEMO_MODULES: DemoModule[] = [
  // Core
  {
    key: "accueil",
    icon: <LayoutDashboard className="h-4 w-4" />,
    label: "Tableau de bord",
    description: "Vue d'ensemble : analyses, recommandations, documents.",
    path: "/accueil",
    category: "core",
  },
  {
    key: "analyses",
    icon: <BarChart3 className="h-4 w-4" />,
    label: "Analyses",
    description: "Flux d'analyse d'entreprise, historique, résultats.",
    path: "/analyses",
    category: "core",
  },
  {
    key: "recommandations",
    icon: <Lightbulb className="h-4 w-4" />,
    label: "Recommandations",
    description: "Recommandations IA contextuelles et priorisées.",
    path: "/recommandations",
    category: "core",
  },
  {
    key: "documents",
    icon: <FileText className="h-4 w-4" />,
    label: "Documents",
    description: "Base documentaire, upload, extraction automatique.",
    path: "/documents",
    category: "core",
  },
  {
    key: "reseau",
    icon: <Network className="h-4 w-4" />,
    label: "Réseau business",
    description: "Entités business, connexions, insights réseau.",
    path: "/reseau",
    category: "core",
  },
  {
    key: "bundles",
    icon: <BookOpen className="h-4 w-4" />,
    label: "Bundles métier",
    description: "Catalogue de bundles sectoriels préconfigurés.",
    path: "/bundles",
    category: "core",
  },
  // IA
  {
    key: "copilote",
    icon: <Sparkles className="h-4 w-4" />,
    label: "Copilote IA",
    description: "Assistant IA contextuel en temps réel.",
    path: "/copilote",
    category: "ia",
  },
  {
    key: "mode-directeur",
    icon: <TrendingUp className="h-4 w-4" />,
    label: "Mode Directeur",
    description: "Monitoring proactif, insights dirigeants.",
    path: "/mode-directeur",
    category: "ia",
  },
  {
    key: "simulation",
    icon: <PieChart className="h-4 w-4" />,
    label: "Simulation",
    description: "Scénarios stratégiques, analyse d'impact.",
    path: "/simulation",
    category: "ia",
  },
  {
    key: "playbooks",
    icon: <Workflow className="h-4 w-4" />,
    label: "Playbooks",
    description: "Workflows automatisés, étapes, suivi d'exécution.",
    path: "/playbooks",
    category: "ia",
  },
  {
    key: "agents",
    icon: <Cpu className="h-4 w-4" />,
    label: "Agents IA",
    description: "Sessions d'agents autonomes, traces de raisonnement.",
    path: "/agents",
    category: "ia",
  },
  {
    key: "maturite",
    icon: <Activity className="h-4 w-4" />,
    label: "Maturité IA",
    description: "Évaluation du niveau de maturité IA de l'entreprise.",
    path: "/maturite",
    category: "ia",
  },
  {
    key: "workflows",
    icon: <Zap className="h-4 w-4" />,
    label: "Workflows",
    description: "Orchestration de workflows, historique des exécutions.",
    path: "/workflows",
    category: "ia",
  },
  {
    key: "marketplace",
    icon: <Globe className="h-4 w-4" />,
    label: "Marketplace",
    description: "Plugins disponibles, installations actives.",
    path: "/marketplace",
    category: "ia",
  },
  // Admin
  {
    key: "supervision",
    icon: <ShieldCheck className="h-4 w-4" />,
    label: "Supervision",
    description: "Santé système, alertes IA, KPIs d'exploitation.",
    path: "/supervision",
    category: "admin",
  },
  {
    key: "gouvernance-ia",
    icon: <Brain className="h-4 w-4" />,
    label: "Gouvernance IA",
    description: "Audit IA, traces, coûts, conformité.",
    path: "/gouvernance-ia",
    category: "admin",
  },
  {
    key: "personas",
    icon: <Users className="h-4 w-4" />,
    label: "Personas",
    description: "Contextes d'affichage personnalisés par profil.",
    path: "/personas",
    category: "admin",
  },
  {
    key: "connectors",
    icon: <Settings2 className="h-4 w-4" />,
    label: "Connecteurs",
    description: "Synchronisation des sources de données externes.",
    path: "/connectors",
    category: "admin",
  },
];

const CHECKLIST: ChecklistItem[] = [
  { id: "compte", label: "Compte actif et session valide" },
  { id: "donnees", label: "Données de démonstration disponibles (au moins une analyse)" },
  { id: "ecran", label: "Écran configuré (résolution, zoom 100%)" },
  { id: "notifications", label: "Notifications silencieuses ou désactivées" },
  { id: "copilote", label: "Copilote IA fonctionnel (réponse en < 3 s)" },
  { id: "documents", label: "Au moins un document chargé dans la base" },
  { id: "bundles", label: "Un bundle métier activé" },
];

const CATEGORY_LABELS: Record<DemoModule["category"], string> = {
  core: "Modules cœur",
  ia: "Intelligence artificielle",
  admin: "Administration",
};

const CATEGORY_COLORS: Record<DemoModule["category"], string> = {
  core: "text-blue-600 bg-blue-50 border-blue-100",
  ia: "text-violet-600 bg-violet-50 border-violet-100",
  admin: "text-slate-600 bg-slate-50 border-slate-100",
};

// ─── Hook mode présentation ───────────────────────────────────────────────────

const SESSION_KEY = "pme.demoMode";

function useDemoMode() {
  const [active, setActive] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "true",
  );

  const toggle = () => {
    const next = !active;
    if (next) {
      sessionStorage.setItem(SESSION_KEY, "true");
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
    setActive(next);
    // Broadcast pour que d'autres composants puissent réagir
    window.dispatchEvent(new CustomEvent("pme:demoMode", { detail: { active: next } }));
  };

  return { active, toggle };
}

// ─── Composants ──────────────────────────────────────────────────────────────

function DemoModeToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5 transition-colors",
        active
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-10 w-10 items-center justify-center rounded-xl",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {active ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Mode présentation
            </p>
            <p className="text-xs text-muted-foreground">
              {active
                ? "Actif — les données sensibles sont masquées dans l'interface."
                : "Inactif — l'interface affiche les données réelles."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={active}
          className={[
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            active ? "bg-primary" : "bg-muted",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200",
              active ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
      {active && (
        <p className="mt-3 text-xs text-primary/80">
          ✓ Mode actif pour cet onglet. Il sera automatiquement désactivé à la fermeture.
        </p>
      )}
    </div>
  );
}

function ModuleGrid() {
  const navigate = useNavigate();
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const categories: DemoModule["category"][] = ["core", "ia", "admin"];

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const modules = DEMO_MODULES.filter((m) => m.category === cat);
        return (
          <div key={cat}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setVisited((v) => new Set([...v, m.key]));
                    navigate(m.path);
                  }}
                  className={[
                    "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:shadow-sm",
                    visited.has(m.key)
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-border bg-card hover:border-primary/30 hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm",
                      visited.has(m.key)
                        ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                        : CATEGORY_COLORS[m.category],
                    ].join(" ")}
                  >
                    {m.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "text-sm font-medium",
                        visited.has(m.key) ? "text-emerald-800" : "text-foreground",
                      ].join(" ")}
                    >
                      {m.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.description}
                    </p>
                  </div>
                  {visited.has(m.key) ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {visited.size > 0 && (
        <p className="text-right text-xs text-muted-foreground">
          {visited.size} / {DEMO_MODULES.length} modules visités
        </p>
      )}
    </div>
  );
}

function PreDemoChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allDone = checked.size === CHECKLIST.length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Checklist pré-démo
          </h2>
        </div>
        {allDone && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Prêt ✓
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {CHECKLIST.map((item) => {
          const done = checked.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  done
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                    : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-accent/30",
                ].join(" ")}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {!allDone && checked.size > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {CHECKLIST.length - checked.size} point
          {CHECKLIST.length - checked.size > 1 ? "s" : ""} restant
          {CHECKLIST.length - checked.size > 1 ? "s" : ""} avant le début.
        </p>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DemoModePage() {
  const { active, toggle } = useDemoMode();

  // Réinitialise le flag si on quitte la page (sécurité)
  useEffect(() => {
    return () => {
      // Ne pas désactiver ici — l'utilisateur doit le faire manuellement
      // pour pouvoir parcourir l'app en mode présentation.
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MonitorPlay className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mode Présentation</h1>
          <p className="text-sm text-muted-foreground">
            Préparez et guidez une démonstration de la plateforme PME en quelques clics.
          </p>
        </div>
      </header>

      {/* Toggle mode présentation */}
      <DemoModeToggle active={active} onToggle={toggle} />

      {/* Grille des modules */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Parcours guidé — modules clés
          </h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Cliquez sur un module pour y accéder directement. Les modules visités
          sont marqués en vert pour suivre votre avancement.
        </p>
        <ModuleGrid />
      </div>

      {/* Checklist */}
      <PreDemoChecklist />
    </div>
  );
}
