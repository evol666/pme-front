import axiosClient from '@/api/axiosClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Hooks API Onboarding (LOT 38 — Wizard de premier démarrage).
// Endpoints Spring Boot sous /api/onboarding/*.

// --- Types ---

export interface StepDef {
  number: number;
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  cta: string;
}

export interface OnboardingState {
  tenant_id: string;
  user_id: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  total_steps: number;
  data: Record<string, unknown>;
  steps: StepDef[];
  summary?: OnboardingSummary;
}

export interface HeadcountOption {
  value: string;
  label: string;
}

export interface WelcomePayload {
  company_name: string;
  secteur: string;
  headcount: string;
  headcount_label: string;
  activity: string;
  siren: string;
  prefilled: boolean;
  headcount_options: HeadcountOption[];
}

export interface MaturitySnapshotLite {
  global_score: number;
  overall_level: string;
  dimensions?: Array<{
    dimension_key: string;
    dimension_label: string;
    score: number;
  }>;
}

export interface DiagnosticResult {
  maturity: {
    snapshot?: MaturitySnapshotLite;
    roadmap?: Array<{
      label: string;
      rationale: string;
      deep_route?: string | null;
    }>;
  } | null;
  profile: {
    activity_summary?: string | null;
    positioning?: string | null;
    offerings: string[];
    targets: string[];
    differentiators: string[];
    confidence_score: number;
    documents_count: number;
  };
  persona: {
    code: string;
    label: string;
    confidence: number;
  } | null;
  generated_at: string;
}

export interface DeliverableDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  accent: string;
  deep_route: string;
}

export interface DeliverableResult {
  kind: string;
  label: string;
  deep_route: string | null;
  markdown: string;
  generated_at: string;
}

export interface NextAction {
  label: string;
  rationale?: string;
  deep_route?: string | null;
}

export interface OnboardingSummary {
  maturity_score: number | null;
  maturity_level: string | null;
  documents_count: number;
  first_deliverable: { kind: string; label: string } | null;
  next_actions: NextAction[];
}

// --- Query Keys ---

export const onboardingKeys = {
  state: () => ['onboarding', 'state'] as const,
  welcome: () => ['onboarding', 'welcome'] as const,
  deliverables: () => ['onboarding', 'deliverables'] as const,
};

// --- Hooks ---

export function useOnboardingState() {
  return useQuery({
    queryKey: onboardingKeys.state(),
    queryFn: async () => {
      const { data } = await axiosClient.get<OnboardingState>('/api/onboarding/state');
      return data;
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useStartOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.post<OnboardingState>('/api/onboarding/start');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onboardingKeys.state() }),
  });
}

export function useGoToStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (step: number) => {
      const { data } = await axiosClient.post<OnboardingState>('/api/onboarding/step', { step });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onboardingKeys.state() }),
  });
}

export function useOnboardingWelcome() {
  return useQuery({
    queryKey: onboardingKeys.welcome(),
    queryFn: async () => {
      const { data } = await axiosClient.get<WelcomePayload>('/api/onboarding/welcome');
      return data;
    },
  });
}

export function useSaveWelcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<{
      company_name: string;
      secteur: string;
      headcount: string;
      activity: string;
      siren: string;
    }>) => {
      const { data } = await axiosClient.post<WelcomePayload>('/api/onboarding/welcome', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onboardingKeys.welcome() }),
  });
}

export function useRunDiagnostic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.post<DiagnosticResult>('/api/onboarding/diagnostic');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onboardingKeys.state() }),
  });
}

export function useOnboardingDeliverables() {
  return useQuery({
    queryKey: onboardingKeys.deliverables(),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ items: DeliverableDef[] }>('/api/onboarding/deliverables');
      return data.items ?? data;
    },
  });
}

export function useGenerateDeliverable() {
  return useMutation({
    mutationFn: async (kind: string) => {
      const { data } = await axiosClient.post<DeliverableResult>('/api/onboarding/deliverable', { kind });
      return data;
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.post<OnboardingState>('/api/onboarding/complete');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: onboardingKeys.state() }),
  });
}
