import axiosClient from '@/api/axiosClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Hooks API Playbooks intelligents (LOT 31).
// Endpoints : /api/playbooks/*.

// --- Types ---

export type StepKind = 'action' | 'module' | 'workflow' | 'recommendation' | 'question';
export type StepStatus = 'pending' | 'in_progress' | 'done' | 'skipped' | 'blocked';
export type RunStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface StepDefinition {
  key: string;
  label: string;
  description: string;
  kind: StepKind | string;
  module_id?: string | null;
  workflow_id?: string | null;
  recommendation_action?: string | null;
  automation_hint?: string | null;
  required: boolean;
  est_duration?: string | null;
}

export interface PlaybookCatalogItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  tone: string;
  related_objectives: string[];
  steps: StepDefinition[];
  hints: string[];
}

export interface StepState {
  id: string;
  step_key: string;
  label: string;
  description?: string | null;
  kind: StepKind | string;
  status: StepStatus;
  note?: string | null;
  module_id?: string | null;
  workflow_id?: string | null;
  recommendation_action?: string | null;
  automation_hint?: string | null;
  required: boolean;
  est_duration?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface PlaybookRun {
  id: string;
  playbook_key: string;
  playbook_label: string;
  label?: string | null;
  params: Record<string, unknown>;
  status: RunStatus;
  completion_pct: number;
  steps: StepState[];
  mission_aligned_goal?: string | null;
  alignment_score?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlaybookSuggestion {
  kind: 'missing_step' | 'automation' | 'tone' | 'note' | string;
  label: string;
  rationale?: string | null;
  source: 'heuristic' | 'llm' | 'stats' | string;
  impact: 'low' | 'medium' | 'high' | string;
}

export interface PlaybookStats {
  playbook_key: string;
  runs_total: number;
  runs_completed: number;
  runs_abandoned: number;
  completion_rate: number;
  avg_steps_done: number;
  avg_duration_days?: number | null;
  most_skipped_steps: string[];
}

export interface PlaybookOverview {
  catalog: PlaybookCatalogItem[];
  active_runs: PlaybookRun[];
}

export interface PlaybookRunRequest {
  playbook_key: string;
  label?: string | null;
  params?: Record<string, unknown>;
}

export interface PatchStepPayload {
  status?: StepStatus;
  note?: string | null;
}

// --- Query Keys ---

export const playbooksKeys = {
  all: ['playbooks'] as const,
  overview: () => ['playbooks', 'overview'] as const,
  catalog: () => ['playbooks', 'catalog'] as const,
  runs: (limit: number) => ['playbooks', 'runs', limit] as const,
  run: (runId: string) => ['playbooks', 'run', runId] as const,
  intelligence: (key: string) => ['playbooks', 'intelligence', key] as const,
};

// --- Hooks ---

export function usePlaybooksOverview() {
  return useQuery({
    queryKey: playbooksKeys.overview(),
    queryFn: async () => {
      const { data } = await axiosClient.get<PlaybookOverview>('/api/playbooks');
      return data;
    },
  });
}

export function usePlaybooksCatalog() {
  return useQuery({
    queryKey: playbooksKeys.catalog(),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: PlaybookCatalogItem[] }>('/api/playbooks/catalog');
      return data.items ?? data;
    },
    staleTime: 10 * 60_000,
  });
}

export function usePlaybookRuns(limit = 30) {
  return useQuery({
    queryKey: playbooksKeys.runs(limit),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: PlaybookRun[] }>(
        `/api/playbooks/runs?limit=${limit}`,
      );
      return data.items ?? data;
    },
  });
}

export function usePlaybookRun(runId: string | null) {
  return useQuery({
    queryKey: runId ? playbooksKeys.run(runId) : ['playbooks', 'run', 'none'],
    enabled: runId != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<PlaybookRun>(`/api/playbooks/${encodeURIComponent(runId!)}`);
      return data;
    },
  });
}

export function useStartPlaybookRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PlaybookRunRequest) => {
      const { data } = await axiosClient.post<PlaybookRun>('/api/playbooks/run', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: playbooksKeys.all }),
  });
}

export function usePatchPlaybookStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      runId,
      stepKey,
      payload,
    }: {
      runId: string;
      stepKey: string;
      payload: PatchStepPayload;
    }) => {
      const { data } = await axiosClient.post<PlaybookRun>(
        `/api/playbooks/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepKey)}`,
        payload,
      );
      return data;
    },
    onSuccess: (_, { runId }) => qc.invalidateQueries({ queryKey: playbooksKeys.run(runId) }),
  });
}

export function useCompletePlaybookRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data } = await axiosClient.post<PlaybookRun>(
        `/api/playbooks/${encodeURIComponent(runId)}/complete`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: playbooksKeys.all }),
  });
}

export function useAbandonPlaybookRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data } = await axiosClient.post<PlaybookRun>(
        `/api/playbooks/${encodeURIComponent(runId)}/abandon`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: playbooksKeys.all }),
  });
}

export function usePlaybookIntelligence(playbookKey: string) {
  return useQuery({
    queryKey: playbooksKeys.intelligence(playbookKey),
    enabled: !!playbookKey,
    queryFn: async () => {
      const { data } = await axiosClient.get<{ stats: PlaybookStats; suggestions: PlaybookSuggestion[] }>(
        `/api/playbooks/intelligence/${encodeURIComponent(playbookKey)}`,
      );
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
