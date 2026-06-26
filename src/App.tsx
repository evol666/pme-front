import { lazy, Suspense, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAppSelector } from "@/app/hooks";
import RequireAuth from "@/features/auth/RequireAuth";

// Accueil : tableau de bord agrégeant analyses / recommandations / documents.
const AccueilPage = lazy(() => import("@/pages/AccueilPage"));

// Flux d'analyse d'entreprise /api/company/analyze.
const AnalysesPage = lazy(() => import("@/pages/AnalysesPage"));
const AnalysePage = lazy(() => import("@/pages/AnalysePage"));
const ResultatPage = lazy(() => import("@/pages/ResultatPage"));

// Assistant IA contextuel /api/copilot.
const CopilotePage = lazy(() => import("@/pages/CopilotePage"));

// Pilotage stratégique /api/user-priorities + /api/copilot/v2/priorities.
const MissionControlPage = lazy(() => import("@/pages/MissionControlPage"));

// Mémoire stratégique /api/knowledge-entities + /api/knowledge-signals.
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"));

// Catalogue de bundles /api/studio-bundles.
const BundlesPage = lazy(() => import("@/pages/BundlesPage"));
const BundleDetailPage = lazy(() => import("@/pages/BundleDetailPage"));

// Sessions d'agents /api/agent-runs.
const AgentsPage = lazy(() => import("@/pages/AgentsPage"));
const AgentRunDetailPage = lazy(() => import("@/pages/AgentRunDetailPage"));

// Réseau business /api/business-entities + /api/connections + /api/network-insights.
const ReseauPage = lazy(() => import("@/pages/ReseauPage"));

// Admin : supervision, analytics, admin-global.
const SupervisionPage = lazy(() => import("@/pages/SupervisionPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const AdminGlobalPage = lazy(() => import("@/pages/AdminGlobalPage"));

// Recherche RAG : /api/rag.
const RagSearchPage = lazy(() => import("@/pages/RagSearchPage"));

// Workflows : /api/workflow-runs + /api/workflow-steps.
const WorkflowsPage = lazy(() => import("@/pages/WorkflowsPage"));
const WorkflowExecutionPage = lazy(() => import("@/pages/WorkflowExecutionPage"));

// Connecteurs : /api/connector-syncs + /api/connector-webhooks.
const ConnectorsPage = lazy(() => import("@/pages/ConnectorsPage"));

// Notifications : /api/notifications.
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));

// Onboarding : /api/onboarding/state + /api/onboarding/steps.
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));

// Mode Directeur : /api/proactive-insights + /api/director-*.
const ModeDirecteurPage = lazy(() => import("@/pages/ModeDirecteurPage"));

// Playbooks : /api/playbooks + /api/playbook-steps + /api/playbook-runs.
const PlaybooksPage = lazy(() => import("@/pages/PlaybooksPage"));
const PlaybookRunPage = lazy(() => import("@/pages/PlaybookRunPage"));

// Portefeuille d'entreprises (CRUD + wizard) et fiche détail tabulaire.
const EntreprisesPage = lazy(() => import("@/pages/EntreprisesPage"));
const EntrepriseDetailPage = lazy(() => import("@/pages/EntrepriseDetailPage"));

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-full border-r border-border/50">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden animate-in slide-in-from-left duration-300">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <AppHeader onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 scroll-smooth custom-scrollbar">
          <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

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
      {/* Redirects conservés */}
      <Route path="/" element={<Navigate to="/accueil" replace />} />
      <Route path="/dashboard" element={<Navigate to="/accueil" replace />} />
      <Route path="/copilot" element={<Navigate to="/copilote" replace />} />
      <Route path="/reseau-eti" element={<Navigate to="/reseau" replace />} />
      <Route path="/objectifs" element={<Navigate to="/mission-control" replace />} />
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
          path="/copilote"
          element={
            <Suspense fallback={<PageLoader />}>
              <CopilotePage />
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
          path="/bundles/:bundleId"
          element={
            <Suspense fallback={<PageLoader />}>
              <BundleDetailPage />
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
          path="/agents/:runId"
          element={
            <Suspense fallback={<PageLoader />}>
              <AgentRunDetailPage />
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
          path="/workflows/runs/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <WorkflowExecutionPage />
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
          path="/notifications"
          element={
            <Suspense fallback={<PageLoader />}>
              <NotificationsPage />
            </Suspense>
          }
        />
        <Route
          path="/onboarding"
          element={
            <Suspense fallback={<PageLoader />}>
              <OnboardingPage />
            </Suspense>
          }
        />
        <Route
          path="/mode-directeur"
          element={
            <Suspense fallback={<PageLoader />}>
              <ModeDirecteurPage />
            </Suspense>
          }
        />
        <Route
          path="/playbooks"
          element={
            <Suspense fallback={<PageLoader />}>
              <PlaybooksPage />
            </Suspense>
          }
        />
        <Route
          path="/playbooks/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <PlaybookRunPage />
            </Suspense>
          }
        />
        <Route
          path="/entreprises"
          element={
            <Suspense fallback={<PageLoader />}>
              <EntreprisesPage />
            </Suspense>
          }
        />
        <Route
          path="/entreprises/:siren"
          element={
            <Suspense fallback={<PageLoader />}>
              <EntrepriseDetailPage />
            </Suspense>
          }
        />
      </Route>

      {/* Redirection par défaut */}
      <Route path="*" element={<Navigate to="/accueil" replace />} />
    </Routes>
  );
}

export default App;
