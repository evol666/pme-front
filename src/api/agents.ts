import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Agents (LOT orchestration multi-agents) — version Spring Boot CRUD.
// Backend : AgentRunResource (/api/agent-runs), AgentMessageResource
// (/api/agent-messages), AgentReasoningStepResource (/api/agent-reasoning-steps),
// AgentSharedMemoryResource (/api/agent-shared-memories). Tous les criteria des
// entités liées exposent `runId.equals` pour filtrer par run. Voir
// [[pme-migration-fastapi-only-endpoints]] (aucun endpoint agents n'est FastAPI-only
// ici — toute la couche agents est CRUD JHipster).

// DTOs Spring Boot en camelCase (naming strategy Jackson standard). Les champs @Lob
// (question, agentIds, error, metadataJson, content, references, attributes, thought,
// value) sont des chaînes (JSON sérialisé pour les tableaux/objets).

export type AgentRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface TenantRef {
  id: number;
}

export interface AppUserRef {
  id: number;
  login?: string | null;
  email?: string | null;
}

export interface AgentRun {
  id: number;
  topic: string;
  question: string | null; // @Lob
  mode: string; // dag | debate | parallel …
  agentIds: string | null; // @Lob : tableau JSON sérialisé
  status: AgentRunStatus;
  error: string | null; // @Lob
  durationMs: number | null;
  metadataJson: string | null; // @Lob : objet JSON sérialisé
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  tenant: TenantRef;
  user: AppUserRef | null;
}

export interface AgentMessage {
  id: number;
  turn: number;
  agentId: string;
  role: string;
  kind: string;
  content: string | null; // @Lob
  confidence: number | null;
  references: string | null; // @Lob
  attributes: string | null; // @Lob
  createdAt: string;
  run: { id: number };
  tenant: TenantRef;
}

export interface AgentReasoningStep {
  id: number;
  agentId: string;
  step: string;
  thought: string | null; // @Lob
  attributes: string | null; // @Lob
  createdAt: string;
  tenant: TenantRef;
  run: { id: number } | null;
}

export interface AgentSharedMemory {
  id: number;
  scope: string;
  key: string;
  value: string | null; // @Lob
  ttlSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
  run: { id: number } | null;
}

// --- Query Keys ---

export const agentsKeys = {
  all: ["agents"] as const,
  runs: (topic?: string, status?: AgentRunStatus, mode?: string) =>
    ["agents", "runs", { topic, status, mode }] as const,
  run: (id: number) => ["agents", "runs", "detail", id] as const,
  messages: (runId: number) => ["agents", "messages", runId] as const,
  reasoning: (runId: number) => ["agents", "reasoning", runId] as const,
  sharedMemory: (runId: number) => ["agents", "sharedMemory", runId] as const,
};

// --- Runs ---

export function useAgentRuns(topic?: string, status?: AgentRunStatus, mode?: string) {
  return useQuery({
    queryKey: agentsKeys.runs(topic, status, mode),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (topic) params["topic.contains"] = topic;
      if (status) params["status.equals"] = status;
      if (mode) params["mode.equals"] = mode;
      const { data } = await axiosClient.get<AgentRun[]>("/api/agent-runs", { params });
      return data;
    },
  });
}

// Détail d'un run (GET /api/agent-runs/{id}). Renvoie null si l'ID est absent/ invalide.
export function useAgentRun(id: number | null) {
  return useQuery({
    queryKey: id == null ? ["agents", "runs", "detail", "none"] : agentsKeys.run(id),
    enabled: id != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<AgentRun>(`/api/agent-runs/${id}`);
      return data;
    },
  });
}

export function useDeleteAgentRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/agent-runs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: agentsKeys.all }),
  });
}

// --- Entités liées à un run (détail expansible) ---

export function useAgentMessages(runId: number | null) {
  return useQuery({
    queryKey: runId ? agentsKeys.messages(runId) : ["agents", "messages", "none"],
    enabled: runId != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<AgentMessage[]>("/api/agent-messages", {
        params: { "runId.equals": String(runId) },
      });
      return data.sort((a, b) => a.turn - b.turn || a.createdAt.localeCompare(b.createdAt));
    },
  });
}

export function useAgentReasoningSteps(runId: number | null) {
  return useQuery({
    queryKey: runId ? agentsKeys.reasoning(runId) : ["agents", "reasoning", "none"],
    enabled: runId != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<AgentReasoningStep[]>(
        "/api/agent-reasoning-steps",
        { params: { "runId.equals": String(runId) } },
      );
      return data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  });
}

export function useAgentSharedMemory(runId: number | null) {
  return useQuery({
    queryKey: runId ? agentsKeys.sharedMemory(runId) : ["agents", "sharedMemory", "none"],
    enabled: runId != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<AgentSharedMemory[]>(
        "/api/agent-shared-memories",
        { params: { "runId.equals": String(runId) } },
      );
      return data;
    },
  });
}

// --- Utilitaire ---

// Parse défensivement un @Lob contenant un tableau JSON (ex. agentIds). Renvoie []
// si absent ou mal formé.
export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}