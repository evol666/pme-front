import axiosClient from '@/api/axiosClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Hooks API Simulation stratégique (LOT 30).
// Endpoints : /api/simulation/*.

// --- Types ---

export type ChargeLevel = 'legere' | 'moderee' | 'soutenue' | 'forte';
export type RoiLevel = 'modeste' | 'notable' | 'significatif' | 'transformateur';
export type SimulationHorizon = '3m' | '6m' | '12m' | '18m';
export type Magnitude = 'low' | 'medium' | 'high';
export type MaturityLevel = 'emerging' | 'ready' | 'advanced';
export type SimulationStatus = 'active' | 'discarded' | 'promoted';
export type ImpactDirection = 'positive' | 'mixte' | 'attention' | string;

export interface ScenarioParamField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  required?: boolean;
  default?: unknown;
  placeholder?: string | null;
  help?: string | null;
  options?: string[];
  min?: number | null;
  max?: number | null;
}

export interface ScenarioCatalogItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  tone: string;
  estimated_horizon: SimulationHorizon;
  related_objectives: string[];
  param_fields: ScenarioParamField[];
  hints: string[];
}

export interface OpportunityItem {
  label: string;
  rationale?: string | null;
  magnitude: Magnitude;
}

export interface RiskItem {
  label: string;
  rationale?: string | null;
  severity: Magnitude;
  mitigation?: string | null;
}

export interface ImpactItem {
  label: string;
  direction: ImpactDirection;
  horizon: SimulationHorizon;
  rationale?: string | null;
}

export interface MaturityAxis {
  key: string;
  label: string;
  required: MaturityLevel;
  note?: string | null;
}

export interface ChargeEstimate {
  level: ChargeLevel;
  range_label: string;
  notes: string[];
}

export interface RoiEstimate {
  level: RoiLevel;
  horizon: SimulationHorizon;
  summary: string;
  drivers: string[];
  caveats: string[];
}

export interface SimulationResult {
  headline: string;
  narrative: string;
  opportunities: OpportunityItem[];
  risks: RiskItem[];
  impacts: ImpactItem[];
  charge: ChargeEstimate;
  roi: RoiEstimate;
  maturity: MaturityAxis[];
  conditions: string[];
  first_step?: string | null;
  alignment_score?: number | null;
  aligned_with_goal?: string | null;
}

export interface SimulationRun {
  id: string;
  scenario_key: string;
  scenario_label: string;
  label?: string | null;
  params: Record<string, unknown>;
  result: SimulationResult;
  status: SimulationStatus;
  alignment_score?: number | null;
  mission_primary_goal?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SimulationRunRequest {
  scenario_key: string;
  params?: Record<string, unknown>;
  label?: string | null;
}

// --- Query Keys ---

export const simulationKeys = {
  all: ['simulation'] as const,
  catalog: () => ['simulation', 'catalog'] as const,
  history: (limit: number) => ['simulation', 'history', limit] as const,
  run: (runId: string) => ['simulation', 'run', runId] as const,
};

// --- Hooks ---

export function useSimulationCatalog() {
  return useQuery({
    queryKey: simulationKeys.catalog(),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: ScenarioCatalogItem[] }>('/api/simulation/catalog');
      return data.items ?? data;
    },
    staleTime: 10 * 60_000,
  });
}

export function useSimulationHistory(limit = 30) {
  return useQuery({
    queryKey: simulationKeys.history(limit),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: SimulationRun[] }>(
        `/api/simulation/history?limit=${limit}`,
      );
      return data.items ?? data;
    },
  });
}

export function useSimulationRun(runId: string | null) {
  return useQuery({
    queryKey: runId ? simulationKeys.run(runId) : ['simulation', 'run', 'none'],
    enabled: runId != null,
    queryFn: async () => {
      const { data } = await axiosClient.get<SimulationRun>(`/api/simulation/${encodeURIComponent(runId!)}`);
      return data;
    },
  });
}

export function useRunSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SimulationRunRequest) => {
      const { data } = await axiosClient.post<SimulationRun>('/api/simulation/run', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.all }),
  });
}

export function useDiscardSimulationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data } = await axiosClient.post<SimulationRun>(
        `/api/simulation/${encodeURIComponent(runId)}/discard`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.all }),
  });
}

export function usePromoteSimulationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const { data } = await axiosClient.post<SimulationRun>(
        `/api/simulation/${encodeURIComponent(runId)}/promote`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.all }),
  });
}
