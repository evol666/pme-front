import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAppSelector } from "@/app/hooks";
import RequireAuth from "@/features/auth/RequireAuth";
import PlaceholderPage from "@/pages/PlaceholderPage";

// Accueil : tableau de bord agrégeant analyses / recommandations / documents
// (Phase 3). Données 100% backend Spring Boot, aucune dépendance FastAPI.
const AccueilPage = lazy(() => import("@/pages/AccueilPage"));

// Pages cœur migrées (Phase 3) : flux d'analyse d'entreprise /api/company/analyze.
const AnalysesPage = lazy(() => import("@/pages/AnalysesPage"));
const AnalysePage = lazy(() => import("@/pages/AnalysePage"));
const ResultatPage = lazy(() => import("@/pages/ResultatPage"));
const RecommandationsPage = lazy(() => import("@/pages/RecommandationsPage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"));
const AdministrationPage = lazy(() => import("@/pages/AdministrationPage"));

// Pages premium (Phase 4) : assistant IA contextuel /api/copilot.
const CopilotePage = lazy(() => import("@/pages/CopilotePage"));

// Pages premium (Phase 4) : journal d'événements /api/journal-events.
const JournalPage = lazy(() => import("@/pages/JournalPage"));

// Pages premium (Phase 4) : pilotage stratégique /api/user-priorities + /api/copilot/v2/priorities.
const MissionControlPage = lazy(() => import("@/pages/MissionControlPage"));

// Pages premium (Phase 4) : mémoire stratégique /api/knowledge-entities + /api/knowledge-signals
// (CRUD Spring Boot). Le graphe interactif FastAPI n'est pas migré.
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"));

// Pages premium (Phase 4) : catalogue de bundles /api/studio-bundles (CRUD Spring Boot).
// L'endpoint catalogue `/api/bundles/catalog` FastAPI n'est pas migré.
const BundlesPage = lazy(() => import("@/pages/BundlesPage"));

// Pages premium (Phase 4) : sessions d'agents /api/agent-runs (CRUD Spring Boot).
// Trace par run : messages / étapes de raisonnement / mémoire partagée (runId.equals).
const AgentsPage = lazy(() => import("@/pages/AgentsPage"));

// Pages premium (Phase 4) : réseau business /api/business-entities + /api/connections
// + /api/network-insights + /api/network-sync-states (CRUD Spring Boot, 4 onglets).
const ReseauPage = lazy(() => import("@/pages/ReseauPage"));

// Pages admin (Phase 5) : supervision (/api/health snake_case + ai-alerts + kpi-snapshots
// + ai-usages), analytics (/api/analytics-events), admin-global (/api/tenants + tenant-*).
const SupervisionPage = lazy(() => import("@/pages/SupervisionPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const AdminGlobalPage = lazy(() => import("@/pages/AdminGlobalPage"));

// Pages premium (Phase 4) — vague mémoire/billing/rag :
// Personas : /api/user-personas (CRUD sans PUT, role + goals/preferences @Lob).
const PersonasPage = lazy(() => import("@/pages/PersonasPage"));
// Mémoire vivante : timeline /api/memory-events + aside /api/memory-documents.
const MemoireVivantePage = lazy(() => import("@/pages/MemoireVivantePage"));
// Memory Hub : CRUD /api/memory-documents (les endpoints sémantiques FastAPI ne sont pas migrés).
const MemoryHubPage = lazy(() => import("@/pages/MemoryHubPage"));
// Billing : /api/billing (overview/pricing/checkout/portal/invoices).
const BillingPage = lazy(() => import("@/pages/BillingPage"));
// Recherche RAG : /api/rag (ingest/upload/search/ask/documents/stats).
const RagSearchPage = lazy(() => import("@/pages/RagSearchPage"));

// Pages premium (Phase 4) — vague 2 :
// Workflows : /api/workflow-runs (CRUD Spring Boot). Endpoints run/async/schedule/retry/cancel
// FastAPI non migrés. Détail run : /api/workflow-steps (runId.equals).
const WorkflowsPage = lazy(() => import("@/pages/WorkflowsPage"));
const WorkflowExecutionPage = lazy(() => import("@/pages/WorkflowExecutionPage"));
// Connecteurs : /api/connector-syncs + /api/connector-webhooks (CRUD Spring Boot).
// Endpoints providers/health/connect/disconnect FastAPI non migrés.
const ConnectorsPage = lazy(() => import("@/pages/ConnectorsPage"));
// Gouvernance IA : /api/ai-audit-entries + /api/ai-traces + /api/ai-costs (CRUD, ROLE_ADMIN).
const GouvernanceIAPage = lazy(() => import("@/pages/GouvernanceIAPage"));
// Marketplace : /api/marketplace-plugins + /api/marketplace-installations (CRUD).
const MarketplacePage = lazy(() => import("@/pages/MarketplacePage"));
// Bundle Studio : 7 entités /api/studio-* (CRUD Spring Boot). Wizard SSE v2 FastAPI non migré.
const BundleStudioPage = lazy(() => import("@/pages/BundleStudioPage"));
const BundleDetailPage = lazy(() => import("@/pages/BundleDetailPage"));
// Notifications : /api/notifications (CRUD + /unread-count + /refresh + /read-all).
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
// Préférences IA : /api/user-preferences + /api/notification-preferences (PATCH @Lob).
const PreferencesIAPage = lazy(() => import("@/pages/PreferencesIAPage"));
// Sécurité : /api/moderation-incidents (CRUD, actionTaken porte l'état).
const SecuritePage = lazy(() => import("@/pages/SecuritePage"));

// Pages admin (Phase 5) — vague 2/3 :
// Activité : /api/audit-logs (read-only paginé + DELETE). Export CSV/rétention FastAPI non migrés.
const ActivityLogPage = lazy(() => import("@/pages/ActivityLogPage"));
// Facturation électronique : /api/invoices + /api/subscriptions (CRUD Spring Boot).
const FacturationElectroniquePage = lazy(() => import("@/pages/FacturationElectroniquePage"));

// Détail agent run : /api/agent-runs/{id} + messages/reasoning/shared-memory (runId.equals).
const AgentRunDetailPage = lazy(() => import("@/pages/AgentRunDetailPage"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <div className="text-sm text-muted-foreground">Chargement...</div>
      </div>
    </div>
  );
}

function DashboardLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-full border-r border-border/50">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 scroll-smooth custom-scrollbar">
          <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

// Routes canoniques dont la page réelle n'est pas encore migrée (endpoints FastAPI-only).
const PENDING_ROUTES = [
  "/onboarding",
  "/mode-directeur",
  "/simulation",
  "/playbooks",
  "/maturite",
  "/sauvegarde",
  "/demo",
];

// Routes avec paramètre (placeholder tant que la page n'existe pas).
const PENDING_PARAM_ROUTES = ["/playbooks/:id"];

function App() {
  const { sessionChecked } = useAppSelector((s) => s.auth);

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="text-sm text-muted-foreground">
            Vérification de la session…
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Redirects conservés (MIGRATION.md Phase 2.4) */}
      <Route path="/" element={<Navigate to="/accueil" replace />} />
      <Route path="/dashboard" element={<Navigate to="/accueil" replace />} />
      <Route path="/copilot" element={<Navigate to="/copilote" replace />} />
      <Route path="/reseau-eti" element={<Navigate to="/reseau" replace />} />
      <Route path="/objectifs" element={<Navigate to="/mission-control" replace />} />
      <Route path="/simulations" element={<Navigate to="/simulation" replace />} />
      <Route path="/processus" element={<Navigate to="/playbooks" replace />} />
      <Route path="/memoire" element={<Navigate to="/knowledge" replace />} />
      <Route path="/rag" element={<Navigate to="/search" replace />} />
      <Route path="/connecteurs" element={<Navigate to="/connectors" replace />} />

      {/* Routes protégées */}
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route
          path="/accueil"
          element={
            <Suspense fallback={<PageLoader />}>
              <AccueilPage />
            </Suspense>
          }
        />
        <Route
          path="/analyses"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnalysesPage />
            </Suspense>
          }
        />
        <Route
          path="/analyse"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnalysePage />
            </Suspense>
          }
        />
        <Route
          path="/resultat"
          element={
            <Suspense fallback={<PageLoader />}>
              <ResultatPage />
            </Suspense>
          }
        />
        <Route
          path="/recommandations"
          element={
            <Suspense fallback={<PageLoader />}>
              <RecommandationsPage />
            </Suspense>
          }
        />
        <Route
          path="/documents"
          element={
            <Suspense fallback={<PageLoader />}>
              <DocumentsPage />
            </Suspense>
          }
        />
        <Route
          path="/administration"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdministrationPage />
            </Suspense>
          }
        />
        <Route
          path="/copilote"
          element={
            <Suspense fallback={<PageLoader />}>
              <CopilotePage />
            </Suspense>
          }
        />
        <Route
          path="/journal"
          element={
            <Suspense fallback={<PageLoader />}>
              <JournalPage />
            </Suspense>
          }
        />
        <Route
          path="/mission-control"
          element={
            <Suspense fallback={<PageLoader />}>
              <MissionControlPage />
            </Suspense>
          }
        />
        <Route
          path="/knowledge"
          element={
            <Suspense fallback={<PageLoader />}>
              <KnowledgePage />
            </Suspense>
          }
        />
        <Route
          path="/bundles"
          element={
            <Suspense fallback={<PageLoader />}>
              <BundlesPage />
            </Suspense>
          }
        />
        <Route
          path="/agents"
          element={
            <Suspense fallback={<PageLoader />}>
              <AgentsPage />
            </Suspense>
          }
        />
        <Route
          path="/reseau"
          element={
            <Suspense fallback={<PageLoader />}>
              <ReseauPage />
            </Suspense>
          }
        />
        <Route
          path="/supervision"
          element={
            <Suspense fallback={<PageLoader />}>
              <SupervisionPage />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="/admin-global"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminGlobalPage />
            </Suspense>
          }
        />
        <Route
          path="/personas"
          element={
            <Suspense fallback={<PageLoader />}>
              <PersonasPage />
            </Suspense>
          }
        />
        <Route
          path="/memoire-vivante"
          element={
            <Suspense fallback={<PageLoader />}>
              <MemoireVivantePage />
            </Suspense>
          }
        />
        <Route
          path="/memoire-ia"
          element={
            <Suspense fallback={<PageLoader />}>
              <MemoryHubPage />
            </Suspense>
          }
        />
        <Route
          path="/billing"
          element={
            <Suspense fallback={<PageLoader />}>
              <BillingPage />
            </Suspense>
          }
        />
        <Route
          path="/search"
          element={
            <Suspense fallback={<PageLoader />}>
              <RagSearchPage />
            </Suspense>
          }
        />
        <Route
          path="/workflows"
          element={
            <Suspense fallback={<PageLoader />}>
              <WorkflowsPage />
            </Suspense>
          }
        />
        <Route
          path="/connectors"
          element={
            <Suspense fallback={<PageLoader />}>
              <ConnectorsPage />
            </Suspense>
          }
        />
        <Route
          path="/gouvernance-ia"
          element={
            <Suspense fallback={<PageLoader />}>
              <GouvernanceIAPage />
            </Suspense>
          }
        />
        <Route
          path="/marketplace"
          element={
            <Suspense fallback={<PageLoader />}>
              <MarketplacePage />
            </Suspense>
          }
        />
        <Route
          path="/bundle-studio"
          element={
            <Suspense fallback={<PageLoader />}>
              <BundleStudioPage />
            </Suspense>
          }
        />
        <Route
          path="/notifications"
          element={
            <Suspense fallback={<PageLoader />}>
              <NotificationsPage />
            </Suspense>
          }
        />
        <Route
          path="/preferences-ia"
          element={
            <Suspense fallback={<PageLoader />}>
              <PreferencesIAPage />
            </Suspense>
          }
        />
        <Route
          path="/securite"
          element={
            <Suspense fallback={<PageLoader />}>
              <SecuritePage />
            </Suspense>
          }
        />
        <Route
          path="/activite"
          element={
            <Suspense fallback={<PageLoader />}>
              <ActivityLogPage />
            </Suspense>
          }
        />
        <Route
          path="/facturation-electronique"
          element={
            <Suspense fallback={<PageLoader />}>
              <FacturationElectroniquePage />
            </Suspense>
          }
        />
        <Route
          path="/workflows/runs/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <WorkflowExecutionPage />
            </Suspense>
          }
        />
        <Route
          path="/bundles/:bundleId"
          element={
            <Suspense fallback={<PageLoader />}>
              <BundleDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/agents/:runId"
          element={
            <Suspense fallback={<PageLoader />}>
              <AgentRunDetailPage />
            </Suspense>
          }
        />
        {PENDING_ROUTES.map((path) => (
          <Route key={path} path={path} element={<PlaceholderPage />} />
        ))}
        {PENDING_PARAM_ROUTES.map((path) => (
          <Route key={path} path={path} element={<PlaceholderPage />} />
        ))}
      </Route>

      {/* Redirection par défaut */}
      <Route path="*" element={<Navigate to="/accueil" replace />} />
    </Routes>
  );
}

export default App;