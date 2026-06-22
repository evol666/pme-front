import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Workflows (LOT 14 — workflows exécutables). Version Spring Boot :
// WorkflowRunResource (/api/workflow-runs) + WorkflowStepResource
// (/api/workflow-steps). CRUD JHipster standard. Les actions métier (run, retry,
// cancel, schedule) étaient portées par l'ancien FastAPI et ne sont pas
// migrées ici — voir [[pme-migration-fastapi-only-endpoints]].
//
// DTOs Spring Boot en camelCase. Les champs @Lob (inputs, outputs, error) sont
// des chaînes JSON à parser côté client via JSON.parse défensif.

export type WorkflowRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED"
  | "RETRYING";

export interface TenantRef {
  id: number;
}

export interface AppUserRef {
  id: number;
  login?: string | null;
}

export interface WorkflowRun {
  id: number;
  workflowId: string;
  trigger: string;
  status: WorkflowRunStatus;
  inputs: string | null; // @Lob : objet JSON sérialisé
  outputs: string | null; // @Lob : objet JSON sérialisé
  error: string | null; // @Lob : texte libre
  retries: number;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  tenant: TenantRef | null;
  user: AppUserRef | null;
}

export interface WorkflowStep {
  id: number;
  orderIdx: number;
  stepId: string;
  label: string | null;
  status: string; // WorkflowStepStatus ou valeur libre (la colonne est String)
  inputs: string | null; // @Lob
  outputs: string | null; // @Lob
  error: string | null; // @Lob
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  run: { id: number } | null;
}

// --- Query Keys ---

export const workflowsKeys = {
  all: ["workflows"] as const,
  runs: (workflowId?: string, status?: WorkflowRunStatus) =>
    ["workflows", "runs", { workflowId, status }] as const,
  run: (id: number) => ["workflows", "run", id] as const,
  steps: (runId: number) => ["workflows", "steps", runId] as const,
};

// --- Runs ---

export function useWorkflowRuns(workflowId?: string, status?: WorkflowRunStatus) {
  return useQuery({
    queryKey: workflowsKeys.runs(workflowId, status),
    queryFn: async () => {
      const params: Record<string, string> = { sort: "createdAt,desc" };
      if (workflowId) params["workflowId.contains"] = workflowId;
      if (status) params["status.equals"] = status;
      const { data } = await axiosClient.get<WorkflowRun[]>("/api/workflow-runs", {
        params,
      });
      return data;
    },
  });
}

export function useWorkflowRun(id: number | null) {
  return useQuery({
    queryKey: id ? workflowsKeys.run(id) : ["workflows", "run", "none"],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<WorkflowRun>(`/api/workflow-runs/${id}`);
      return data;
    },
  });
}

export function useDeleteWorkflowRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/workflow-runs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowsKeys.all }),
  });
}

// --- Steps (détail d'un run) ---

export function useWorkflowSteps(runId: number | null) {
  return useQuery({
    queryKey: runId ? workflowsKeys.steps(runId) : ["workflows", "steps", "none"],
    enabled: runId != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<WorkflowStep[]>("/api/workflow-steps", {
        params: { "runId.equals": String(runId), sort: "orderIdx,asc" },
      });
      return data.sort((a, b) => a.orderIdx - b.orderIdx);
    },
  });
}

// --- Utilitaires ---

// Parse défensivement un @Lob contenant un objet JSON (ex. inputs, outputs).
// Renvoie null si absent ou mal formé.
export function parseJsonObject(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}