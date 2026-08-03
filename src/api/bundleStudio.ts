import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Bundle Studio (LOT "Studio") — version Spring Boot CRUD uniquement.
// Backend :
//   - StudioProjectResource        /api/studio-projects
//   - StudioAgentResource           /api/studio-agents        (filtrable par bundleId.equals)
//   - StudioPromptResource          /api/studio-prompts       (filtrable par bundleId.equals)
//   - StudioPageResource            /api/studio-pages          (filtrable par bundleId.equals)
//   - StudioApiRouteResource        /api/studio-api-routes     (filtrable par bundleId.equals)
//   - StudioWorkflowResource        /api/studio-workflows      (filtrable par bundleId.equals)
//   - StudioGenerationRunResource  /api/studio-generation-runs (filtrable par projectId.equals)
//
// Les hooks StudioBundle (useBundles/useBundle/useToggleBundle/useDeleteBundle) existent
// déjà dans @/api/bundles.ts — on les réexporte ici pour commodité mais on NE les recréé
// pas. Voir [[pme-migration-fastapi-only-endpoints]] pour les endpoints FastAPI-only non
// migrés (templates, analyze, generate-stream, preview, publish, activate, recommendations).
//
// DTOs Spring Boot en camelCase. Champs @Lob (systemPrompt, capabilities, template,
// variables, layout, handler, definition, brief, log, manifest) sont des chaînes JSON
// sérialisées — parsing défensif côté page, jamais dans les criteria.

// --- Références partagées (réexport depuis bundles.ts) ---

export type { StudioBundle, BundleManifest } from "@/api/bundles";
export {
  useBundles,
  useBundle,
  useToggleBundle,
  useDeleteBundle,
  parseBundleManifest,
  bundlesKeys,
} from "@/api/bundles";

import type { StudioBundle } from "@/api/bundles";

// --- DTOs Spring Boot (camelCase) ---

export interface TenantRef {
  id: number;
  slug: string;
  name: string;
}

export interface AppUserRef {
  id: number;
  email: string;
  fullName: string | null;
}

export type StudioProjectStatus =
  | "DRAFT"
  | "ANALYZING"
  | "GENERATING"
  | "READY"
  | "PUBLISHED"
  | "ARCHIVED"
  | "ERROR";

export interface StudioProject {
  id: number;
  title: string;
  status: StudioProjectStatus; // enum sérialisée en name uppercase
  brief: string | null; // @Lob : chaîne JSON libre
  targetMetier: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
  user: AppUserRef;
}

export interface StudioAgent {
  id: number;
  name: string;
  role: string;
  systemPrompt: string | null; // @Lob
  capabilities: string | null; // @Lob
  createdAt: string;
  bundle: StudioBundle;
}

export interface StudioPrompt {
  id: number;
  name: string;
  category: string | null;
  template: string | null; // @Lob
  variables: string | null; // @Lob
  createdAt: string;
  bundle: StudioBundle;
}

export interface StudioPage {
  id: number;
  slug: string;
  title: string;
  layout: string | null; // @Lob
  createdAt: string;
  bundle: StudioBundle;
}

export interface StudioApiRoute {
  id: number;
  method: string; // GET/POST/PUT/PATCH/DELETE…
  path: string;
  handler: string | null; // @Lob
  createdAt: string;
  bundle: StudioBundle;
}

export interface StudioWorkflow {
  id: number;
  name: string;
  slug: string;
  definition: string | null; // @Lob
  createdAt: string;
  bundle: StudioBundle;
}

export interface StudioGenerationRun {
  id: number;
  status: string; // statut libre (DRAFT/RUNNING/…)
  log: string | null; // @Lob
  createdAt: string;
  finishedAt: string | null;
  project: StudioProject;
}

// --- Query Keys ---

export const studioKeys = {
  all: ["studio"] as const,
  projects: () => ["studio", "projects"] as const,
  projectsList: (filters: {
    titleContains?: string;
    status?: StudioProjectStatus;
    tenantId?: number;
    userId?: number;
  }) =>
    [
      "studio",
      "projects",
      "list",
      {
        titleContains: filters.titleContains,
        status: filters.status,
        tenantId: filters.tenantId,
        userId: filters.userId,
      },
    ] as const,
  projectDetail: (id: number) => ["studio", "projects", "detail", id] as const,
  agents: (filters: { bundleId?: number; nameContains?: string; roleEquals?: string }) =>
    ["studio", "agents", "list", filters] as const,
  agentDetail: (id: number) => ["studio", "agents", "detail", id] as const,
  prompts: (filters: {
    bundleId?: number;
    nameContains?: string;
    categoryEquals?: string;
  }) => ["studio", "prompts", "list", filters] as const,
  promptDetail: (id: number) => ["studio", "prompts", "detail", id] as const,
  pages: (filters: { bundleId?: number; slugContains?: string; titleContains?: string }) =>
    ["studio", "pages", "list", filters] as const,
  pageDetail: (id: number) => ["studio", "pages", "detail", id] as const,
  apiRoutes: (filters: { bundleId?: number; methodEquals?: string; pathContains?: string }) =>
    ["studio", "api-routes", "list", filters] as const,
  apiRouteDetail: (id: number) => ["studio", "api-routes", "detail", id] as const,
  workflows: (filters: { bundleId?: number; nameContains?: string; slugContains?: string }) =>
    ["studio", "workflows", "list", filters] as const,
  workflowDetail: (id: number) => ["studio", "workflows", "detail", id] as const,
  runs: (filters: { projectId?: number; statusEquals?: string }) =>
    ["studio", "runs", "list", filters] as const,
  runDetail: (id: number) => ["studio", "runs", "detail", id] as const,
};

// --- Lecture : StudioProject ---

export function useStudioProjects(filters: {
  titleContains?: string;
  status?: StudioProjectStatus;
  tenantId?: number;
  userId?: number;
} = {}) {
  return useQuery({
    queryKey: studioKeys.projectsList(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.titleContains) params["title.contains"] = filters.titleContains;
      if (filters.status) params["status.equals"] = filters.status;
      if (filters.tenantId != null) params["tenantId.equals"] = String(filters.tenantId);
      if (filters.userId != null) params["userId.equals"] = String(filters.userId);
      const { data } = await axiosClient.get<StudioProject[]>("/api/studio-projects", {
        params,
      });
      return data;
    },
  });
}

export function useStudioProject(id: number | null) {
  return useQuery({
    queryKey:
      id == null ? ["studio", "projects", "detail", "none"] : studioKeys.projectDetail(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioProject>(`/api/studio-projects/${id}`);
      return data;
    },
  });
}

// --- Mutations : StudioProject ---

export interface StudioProjectInput {
  id?: number;
  title: string;
  status: StudioProjectStatus;
  brief?: string | null;
  targetMetier?: string | null;
  tenant: { id: number };
  user: { id: number };
}

export function useCreateStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudioProjectInput) => {
      const { data } = await axiosClient.post<StudioProject>("/api/studio-projects", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: studioKeys.projects() }),
  });
}

export function useUpdateStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: StudioProjectInput }) => {
      const { data } = await axiosClient.put<StudioProject>(`/api/studio-projects/${id}`, {
        ...input,
        id,
      });
      return data;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: studioKeys.projects() });
      qc.invalidateQueries({ queryKey: studioKeys.projectDetail(project.id) });
    },
  });
}

// PATCH merge-patch pour basculer le statut d'un projet (ou autres champs partiels).
// Le backend partialUpdate exige un id non null dans le corps.
export function usePatchStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<StudioProjectInput> }) => {
      const { data } = await axiosClient.patch<StudioProject>(
        `/api/studio-projects/${id}`,
        { id, ...patch },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: studioKeys.projects() });
      qc.invalidateQueries({ queryKey: studioKeys.projectDetail(project.id) });
    },
  });
}

export function useDeleteStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-projects/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: studioKeys.projects() }),
  });
}

// --- Lecture : StudioAgent ---

export function useStudioAgents(filters: {
  bundleId?: number;
  nameContains?: string;
  roleEquals?: string;
} = {}) {
  return useQuery({
    queryKey: studioKeys.agents(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.bundleId != null) params["bundleId.equals"] = String(filters.bundleId);
      if (filters.nameContains) params["name.contains"] = filters.nameContains;
      if (filters.roleEquals) params["role.equals"] = filters.roleEquals;
      const { data } = await axiosClient.get<StudioAgent[]>("/api/studio-agents", { params });
      return data;
    },
  });
}

export function useStudioAgent(id: number | null) {
  return useQuery({
    queryKey:
      id == null ? ["studio", "agents", "detail", "none"] : studioKeys.agentDetail(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioAgent>(`/api/studio-agents/${id}`);
      return data;
    },
  });
}

export interface StudioAgentInput {
  id?: number;
  name: string;
  role: string;
  systemPrompt?: string | null;
  capabilities?: string | null;
  bundle: { id: number };
}

export function useCreateStudioAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudioAgentInput) => {
      const { data } = await axiosClient.post<StudioAgent>("/api/studio-agents", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "agents"] }),
  });
}

export function usePatchStudioAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<StudioAgentInput> }) => {
      const { data } = await axiosClient.patch<StudioAgent>(
        `/api/studio-agents/${id}`,
        { id, ...patch },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "agents"] }),
  });
}

export function useDeleteStudioAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-agents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "agents"] }),
  });
}

// --- Lecture : StudioPrompt ---

export function useStudioPrompts(filters: {
  bundleId?: number;
  nameContains?: string;
  categoryEquals?: string;
} = {}) {
  return useQuery({
    queryKey: studioKeys.prompts(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.bundleId != null) params["bundleId.equals"] = String(filters.bundleId);
      if (filters.nameContains) params["name.contains"] = filters.nameContains;
      if (filters.categoryEquals) params["category.equals"] = filters.categoryEquals;
      const { data } = await axiosClient.get<StudioPrompt[]>("/api/studio-prompts", { params });
      return data;
    },
  });
}

export function useStudioPrompt(id: number | null) {
  return useQuery({
    queryKey:
      id == null ? ["studio", "prompts", "detail", "none"] : studioKeys.promptDetail(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioPrompt>(`/api/studio-prompts/${id}`);
      return data;
    },
  });
}

export interface StudioPromptInput {
  id?: number;
  name: string;
  category?: string | null;
  template?: string | null;
  variables?: string | null;
  bundle: { id: number };
}

export function useCreateStudioPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudioPromptInput) => {
      const { data } = await axiosClient.post<StudioPrompt>("/api/studio-prompts", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "prompts"] }),
  });
}

export function usePatchStudioPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<StudioPromptInput> }) => {
      const { data } = await axiosClient.patch<StudioPrompt>(
        `/api/studio-prompts/${id}`,
        { id, ...patch },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "prompts"] }),
  });
}

export function useDeleteStudioPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-prompts/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "prompts"] }),
  });
}

// --- Lecture : StudioPage ---

export function useStudioPages(filters: {
  bundleId?: number;
  slugContains?: string;
  titleContains?: string;
} = {}) {
  return useQuery({
    queryKey: studioKeys.pages(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.bundleId != null) params["bundleId.equals"] = String(filters.bundleId);
      if (filters.slugContains) params["slug.contains"] = filters.slugContains;
      if (filters.titleContains) params["title.contains"] = filters.titleContains;
      const { data } = await axiosClient.get<StudioPage[]>("/api/studio-pages", { params });
      return data;
    },
  });
}

export function useStudioPage(id: number | null) {
  return useQuery({
    queryKey: id == null ? ["studio", "pages", "detail", "none"] : studioKeys.pageDetail(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioPage>(`/api/studio-pages/${id}`);
      return data;
    },
  });
}

export interface StudioPageInput {
  id?: number;
  slug: string;
  title: string;
  layout?: string | null;
  bundle: { id: number };
}

export function useCreateStudioPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudioPageInput) => {
      const { data } = await axiosClient.post<StudioPage>("/api/studio-pages", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "pages"] }),
  });
}

export function usePatchStudioPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<StudioPageInput> }) => {
      const { data } = await axiosClient.patch<StudioPage>(
        `/api/studio-pages/${id}`,
        { id, ...patch },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "pages"] }),
  });
}

export function useDeleteStudioPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-pages/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "pages"] }),
  });
}

// --- Lecture : StudioApiRoute ---

export function useStudioApiRoutes(filters: {
  bundleId?: number;
  methodEquals?: string;
  pathContains?: string;
} = {}) {
  return useQuery({
    queryKey: studioKeys.apiRoutes(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.bundleId != null) params["bundleId.equals"] = String(filters.bundleId);
      if (filters.methodEquals) params["method.equals"] = filters.methodEquals;
      if (filters.pathContains) params["path.contains"] = filters.pathContains;
      const { data } = await axiosClient.get<StudioApiRoute[]>("/api/studio-api-routes", {
        params,
      });
      return data;
    },
  });
}

export function useStudioApiRoute(id: number | null) {
  return useQuery({
    queryKey:
      id == null ? ["studio", "api-routes", "detail", "none"] : studioKeys.apiRouteDetail(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioApiRoute>(`/api/studio-api-routes/${id}`);
      return data;
    },
  });
}

export interface StudioApiRouteInput {
  id?: number;
  method: string;
  path: string;
  handler?: string | null;
  bundle: { id: number };
}

export function useCreateStudioApiRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudioApiRouteInput) => {
      const { data } = await axiosClient.post<StudioApiRoute>("/api/studio-api-routes", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "api-routes"] }),
  });
}

export function usePatchStudioApiRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<StudioApiRouteInput> }) => {
      const { data } = await axiosClient.patch<StudioApiRoute>(
        `/api/studio-api-routes/${id}`,
        { id, ...patch },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "api-routes"] }),
  });
}

export function useDeleteStudioApiRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-api-routes/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "api-routes"] }),
  });
}

// --- Lecture : StudioWorkflow ---

export function useStudioWorkflows(filters: {
  bundleId?: number;
  nameContains?: string;
  slugContains?: string;
} = {}) {
  return useQuery({
    queryKey: studioKeys.workflows(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.bundleId != null) params["bundleId.equals"] = String(filters.bundleId);
      if (filters.nameContains) params["name.contains"] = filters.nameContains;
      if (filters.slugContains) params["slug.contains"] = filters.slugContains;
      const { data } = await axiosClient.get<StudioWorkflow[]>("/api/studio-workflows", {
        params,
      });
      return data;
    },
  });
}

export function useStudioWorkflow(id: number | null) {
  return useQuery({
    queryKey:
      id == null ? ["studio", "workflows", "detail", "none"] : studioKeys.workflowDetail(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioWorkflow>(`/api/studio-workflows/${id}`);
      return data;
    },
  });
}

export interface StudioWorkflowInput {
  id?: number;
  name: string;
  slug: string;
  definition?: string | null;
  bundle: { id: number };
}

export function useCreateStudioWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudioWorkflowInput) => {
      const { data } = await axiosClient.post<StudioWorkflow>("/api/studio-workflows", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "workflows"] }),
  });
}

export function usePatchStudioWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<StudioWorkflowInput> }) => {
      const { data } = await axiosClient.patch<StudioWorkflow>(
        `/api/studio-workflows/${id}`,
        { id, ...patch },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "workflows"] }),
  });
}

export function useDeleteStudioWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-workflows/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "workflows"] }),
  });
}

// --- Lecture : StudioGenerationRun ---

export function useStudioGenerationRuns(filters: {
  projectId?: number;
  statusEquals?: string;
} = {}) {
  return useQuery({
    queryKey: studioKeys.runs(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.projectId != null) params["projectId.equals"] = String(filters.projectId);
      if (filters.statusEquals) params["status.equals"] = filters.statusEquals;
      const { data } = await axiosClient.get<StudioGenerationRun[]>(
        "/api/studio-generation-runs",
        { params },
      );
      return data;
    },
  });
}

export function useStudioGenerationRun(id: number | null) {
  return useQuery({
    queryKey: id == null ? ["studio", "runs", "detail", "none"] : studioKeys.runDetail(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<StudioGenerationRun>(
        `/api/studio-generation-runs/${id}`,
      );
      return data;
    },
  });
}

export interface StudioGenerationRunInput {
  id?: number;
  status: string;
  log?: string | null;
  finishedAt?: string | null;
  project: { id: number };
}

export function useCreateStudioGenerationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudioGenerationRunInput) => {
      const { data } = await axiosClient.post<StudioGenerationRun>(
        "/api/studio-generation-runs",
        input,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "runs"] }),
  });
}

export function usePatchStudioGenerationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<StudioGenerationRunInput> }) => {
      const { data } = await axiosClient.patch<StudioGenerationRun>(
        `/api/studio-generation-runs/${id}`,
        { id, ...patch },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "runs"] }),
  });
}

export function useDeleteStudioGenerationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/studio-generation-runs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "runs"] }),
  });
}

// --- Utilitaires ---

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    // toLocaleString ne lève pas sur une date invalide : il renvoie
    // "Invalid Date". On teste donc explicitement.
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function extractBackendError(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { error?: { message?: string } }; statusText?: string };
  };
  return (
    axiosErr?.response?.data?.error?.message ??
    axiosErr?.response?.statusText ??
    "Une erreur est survenue. Réessayez."
  );
}

// Parse défensif d'un champ @Lob contenant du JSON. Renvoie null si vide ou invalide.
export function parseLobJson<T = unknown>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Libellés humains pour le statut StudioProject.
export const STUDIO_PROJECT_STATUS_LABEL: Record<StudioProjectStatus, string> = {
  DRAFT: "Brouillon",
  ANALYZING: "Analyse",
  GENERATING: "Génération",
  READY: "Prêt",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
  ERROR: "Erreur",
};