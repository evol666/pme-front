import axiosClient from '@/api/axiosClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Hooks API Mode Directeur / Insights Proactifs (LOT 26).
// Endpoints : /api/proactive/*.

// --- Types ---

export type InsightKind = 'opportunity' | 'risk' | 'action' | 'trend' | 'watch';
export type InsightTone = 'positive' | 'info' | 'attention';

export interface SuggestedAction {
  label: string;
  hint?: string;
  target?: string;
}

export interface DirectorInsight {
  id: string;
  kind: InsightKind | string;
  category: string;
  title: string;
  message: string;
  rationale: string;
  tone: InsightTone | string | null;
  icon: string | null;
  confidence: number;
  priority: number;
  signals: string[];
  suggested_action: SuggestedAction | null;
  source: string;
  status: string;
  created_at: string;
}

export interface MonitoredDomain {
  key: string;
  label: string;
  icon: string;
}

export interface ProactiveStatus {
  active_count: number;
  dismissed_count: number;
  by_kind: Record<string, number>;
  by_tone: Record<string, number>;
  last_recalculated_at: string | null;
  monitored_domains: MonitoredDomain[];
}

export interface SchedulerStatus {
  is_live: boolean;
  monitoring_since: string | null;
  last_scan_at: string | null;
  next_scan_at: string;
  interval_minutes: number;
}

export interface InsightsResponse {
  insights: DirectorInsight[];
  status: ProactiveStatus;
  scheduler: SchedulerStatus;
}

// --- Query Keys ---

export const proactiveKeys = {
  all: ['proactive'] as const,
  insights: () => ['proactive', 'insights'] as const,
  status: () => ['proactive', 'status'] as const,
};

// --- Hooks ---

export function useProactiveInsights(recompute = false) {
  return useQuery({
    queryKey: [...proactiveKeys.insights(), { recompute }],
    queryFn: async () => {
      const { data } = await axiosClient.get<InsightsResponse>(
        `/api/proactive/insights?recompute=${recompute}`,
      );
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useRecalculateInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.post<InsightsResponse>('/api/proactive/recalculate');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: proactiveKeys.all }),
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axiosClient.post<{ dismissed: boolean; id: string }>(
        `/api/proactive/dismiss/${encodeURIComponent(id)}`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: proactiveKeys.all }),
  });
}
