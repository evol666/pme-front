import axiosClient from '@/api/axiosClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Hooks API Maturité Entreprise (LOT 33).
// Endpoints : /api/maturity/*.

// --- Types ---

export type MaturityLevel = 'emerging' | 'established' | 'advanced' | 'optimized';
export type TrendStatus = 'rising' | 'stable' | 'falling' | null;

export interface LevelDefinition {
  level: MaturityLevel | string;
  label: string;
  description: string;
}

export interface IndicatorDefinition {
  label: string;
  hint?: string | null;
}

export interface RoadmapActionDefinition {
  label: string;
  rationale: string;
  deep_route?: string | null;
  related_module?: string | null;
  related_playbook?: string | null;
  related_persona?: string | null;
  impact: 'low' | 'medium' | 'high' | string;
}

export interface QuestionDefinition {
  key: string;
  label: string;
  type: 'scale' | 'yesno' | 'choice' | string;
  options: string[];
  help?: string | null;
}

export interface DimensionDefinition {
  key: string;
  label: string;
  description: string;
  icon: string;
  accent: 'brand' | 'emerald' | 'amber' | 'cyber' | string;
  weight: number;
  levels: LevelDefinition[];
  indicators: IndicatorDefinition[];
  actions: RoadmapActionDefinition[];
  questions: QuestionDefinition[];
  related_persona?: string | null;
}

export interface DimensionScore {
  dimension_key: string;
  dimension_label: string;
  score: number;
  level: MaturityLevel | string;
  benchmark?: number | null;
  delta_vs_benchmark?: number | null;
  signals: string[];
  indicators: IndicatorDefinition[];
  next_level?: MaturityLevel | string | null;
}

export interface RoadmapAction {
  dimension_key: string;
  dimension_label: string;
  action_label: string;
  rationale: string;
  deep_route?: string | null;
  related_module?: string | null;
  related_playbook?: string | null;
  related_persona?: string | null;
  impact: 'low' | 'medium' | 'high' | string;
  order: number;
}

export interface MaturitySnapshot {
  id: string;
  tenant_id: string;
  global_score: number;
  overall_level: MaturityLevel | string;
  dimensions: DimensionScore[];
  secteur?: string | null;
  taille?: string | null;
  benchmark?: {
    secteur: string;
    taille: string;
    by_dimension: Record<string, number>;
    overall_benchmark?: number | null;
    label?: string | null;
  } | null;
  signals_used: Record<string, unknown>;
  comment?: string | null;
  computed_at?: string | null;
  created_at?: string | null;
}

export interface MaturityHistoryPoint {
  computed_at?: string | null;
  score: number;
}

export interface MaturityReport {
  snapshot: MaturitySnapshot;
  roadmap: RoadmapAction[];
  history_global_scores: MaturityHistoryPoint[];
  history_dimension_scores: Record<string, MaturityHistoryPoint[]>;
  trend: TrendStatus;
}

export interface QuestionWithAnswer extends QuestionDefinition {
  dimension_key: string;
  dimension_label: string;
  value: unknown;
}

export interface RecalculateRequest {
  secteur?: string | null;
  taille?: string | null;
  comment?: string | null;
}

// --- Query Keys ---

export const maturityKeys = {
  all: ['maturity'] as const,
  report: (secteur?: string | null, taille?: string | null) =>
    ['maturity', 'report', { secteur, taille }] as const,
  history: (limit: number) => ['maturity', 'history', limit] as const,
  catalog: () => ['maturity', 'catalog'] as const,
  questions: () => ['maturity', 'questions'] as const,
};

// --- Hooks ---

export function useMaturityReport(secteur?: string | null, taille?: string | null) {
  return useQuery({
    queryKey: maturityKeys.report(secteur, taille),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (secteur) params.secteur = secteur;
      if (taille) params.taille = taille;
      const { data } = await axiosClient.get<MaturityReport>('/api/maturity', { params });
      return data;
    },
  });
}

export function useRecalculateMaturity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecalculateRequest = {}) => {
      const { data } = await axiosClient.post<MaturitySnapshot>('/api/maturity/recalculate', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: maturityKeys.all }),
  });
}

export function useMaturityHistory(limit = 30) {
  return useQuery({
    queryKey: maturityKeys.history(limit),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: MaturitySnapshot[] }>(
        `/api/maturity/history?limit=${limit}`,
      );
      return data.items ?? data;
    },
  });
}

export function useMaturityCatalog() {
  return useQuery({
    queryKey: maturityKeys.catalog(),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: DimensionDefinition[] }>('/api/maturity/catalog');
      return data.items ?? data;
    },
    staleTime: 10 * 60_000,
  });
}

export function useMaturityQuestions() {
  return useQuery({
    queryKey: maturityKeys.questions(),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: QuestionWithAnswer[] }>('/api/maturity/questions');
      return data.items ?? data;
    },
  });
}

export function useAnswerMaturityQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dimensionKey,
      questionKey,
      value,
    }: {
      dimensionKey: string;
      questionKey: string;
      value: unknown;
    }) => {
      const { data } = await axiosClient.post(
        `/api/maturity/questions/${encodeURIComponent(dimensionKey)}/${encodeURIComponent(questionKey)}`,
        { value },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: maturityKeys.all }),
  });
}
