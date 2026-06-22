import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API admin (LOT supervision / analytics / admin-global). Version Spring Boot.
// Backend : PmeHealthResource (/api/health — DTO interne snake_case), AiAlertResource
// (/api/ai-alerts — paginé), KpiSnapshotResource (/api/kpi-snapshots), AiUsageResource
// (/api/ai-usages — paginé), AnalyticsEventResource (/api/analytics-events — paginé),
// TenantResource + Tenant{Settings,Profile,Plan,Branding,Memory}Resource.
// PmeKafkaResource (publish/register SSE) n'est pas couvert ici — streaming temps réel,
// hors périmètre d'une page admin CRUD.

// --- Types communs ---

interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
  plan?: string | null;
  status?: string | null;
}

interface UserRef {
  id: number;
}

// Réponse paginée JHipster (Page<T>).
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export type AlertSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TenantPlan = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

// --- Santé AI (snake_case — DTO interne backend) ---

export interface PmeHealth {
  backend_status: string;
  ollama_status: string;
  model: string | null;
  local_ai_ready: boolean;
  user_message: string | null;
}

export function usePmeHealth() {
  return useQuery({
    queryKey: ["admin", "health"],
    queryFn: async () => {
      const { data } = await axiosClient.get<PmeHealth>("/api/health");
      return data;
    },
    refetchInterval: 30000,
  });
}

// --- AiAlert (paginé) ---

export interface AiAlert {
  id: number;
  kind: string;
  severity: AlertSeverity;
  title: string | null; // @Lob
  summary: string | null; // @Lob
  rationale: string | null; // @Lob
  confidence: number;
  signals: string | null; // @Lob
  sources: string | null; // @Lob
  suggestedAction: string | null; // @Lob
  relatedSiren: string | null;
  relatedJobId: string | null;
  status: string;
  createdAt: string;
  seenAt: string | null;
  actedAt: string | null;
  dismissedAt: string | null;
  snoozeUntil: string | null;
  expiresAt: string | null;
  tenant: TenantRef;
  user: UserRef | null;
}

export function useAiAlerts(severity?: AlertSeverity, status?: string) {
  return useQuery({
    queryKey: ["admin", "alerts", { severity, status }],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: "0",
        size: "200",
        sort: "createdAt,desc",
      };
      if (severity) params["severity.equals"] = severity;
      if (status) params["status.equals"] = status;
      const { data } = await axiosClient.get<PageResponse<AiAlert>>("/api/ai-alerts", {
        params,
      });
      return data;
    },
  });
}

export function usePatchAiAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number } & Partial<AiAlert>) => {
      const { id, ...body } = input;
      const { data } = await axiosClient.patch<AiAlert>(`/api/ai-alerts/${id}`, body, {
        headers: { "Content-Type": "application/merge-patch+json" },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "alerts"] }),
  });
}

// --- KpiSnapshot ---

export interface KpiSnapshot {
  id: number;
  kpi: string;
  granularity: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  valuePrev: number | null;
  metadataJson: string | null; // @Lob
  createdAt: string;
  tenant: TenantRef;
}

export function useKpiSnapshots(kpi?: string, granularity?: string) {
  return useQuery({
    queryKey: ["admin", "kpis", { kpi, granularity }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (kpi) params["kpi.equals"] = kpi;
      if (granularity) params["granularity.equals"] = granularity;
      const { data } = await axiosClient.get<KpiSnapshot[]>("/api/kpi-snapshots", {
        params,
      });
      return data;
    },
  });
}

// --- AiUsage (paginé) ---

export interface AiUsage {
  id: number;
  requestId: string | null;
  provider: string;
  model: string;
  endpoint: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicroUsd: number | null;
  latencyMs: number | null;
  status: string;
  errorCode: string | null;
  createdAt: string;
  tenant: TenantRef;
  user: UserRef | null;
}

export function useAiUsages(provider?: string, status?: string) {
  return useQuery({
    queryKey: ["admin", "usages", { provider, status }],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: "0",
        size: "200",
        sort: "createdAt,desc",
      };
      if (provider) params["provider.equals"] = provider;
      if (status) params["status.equals"] = status;
      const { data } = await axiosClient.get<PageResponse<AiUsage>>("/api/ai-usages", {
        params,
      });
      return data;
    },
  });
}

// --- AnalyticsEvent (paginé) ---

export interface AnalyticsEvent {
  id: number;
  eventName: string;
  category: string;
  subjectKind: string | null;
  subjectId: string | null;
  sessionId: string | null;
  requestId: string | null;
  source: string | null;
  valueNum: number | null;
  durationMs: number | null;
  properties: string | null; // @Lob
  occurredAt: string;
  tenant: TenantRef;
  user: UserRef | null;
}

export function useAnalyticsEvents(eventNameContains?: string, category?: string) {
  return useQuery({
    queryKey: ["admin", "events", { eventNameContains, category }],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: "0",
        size: "200",
        sort: "occurredAt,desc",
      };
      if (eventNameContains) params["eventName.contains"] = eventNameContains;
      if (category) params["category.equals"] = category;
      const { data } = await axiosClient.get<PageResponse<AnalyticsEvent>>(
        "/api/analytics-events",
        { params },
      );
      return data;
    },
  });
}

// --- Tenant (racine, admin-global) ---

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  settings: string | null; // @Lob
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function useTenants(slug?: string, nameContains?: string) {
  return useQuery({
    queryKey: ["admin", "tenants", { slug, nameContains }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (slug) params["slug.equals"] = slug;
      if (nameContains) params["name.contains"] = nameContains;
      const { data } = await axiosClient.get<Tenant[]>("/api/tenants", { params });
      return data;
    },
  });
}

export function usePatchTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number } & Partial<Tenant>) => {
      const { id, ...body } = input;
      const { data } = await axiosClient.patch<Tenant>(`/api/tenants/${id}`, body, {
        headers: { "Content-Type": "application/merge-patch+json" },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/tenants/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

// --- TenantSettings ---

export interface TenantSettings {
  id: number;
  customLogoUrl: string | null;
  customPrimaryColor: string | null;
  customSecondaryColor: string | null;
  customDomain: string | null;
  aiPersonality: string | null; // @Lob
  pdfTemplate: string | null;
  enabledFeatures: string | null; // @Lob
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export function useTenantSettings(tenantId?: number) {
  return useQuery({
    queryKey: ["admin", "settings", tenantId ?? "all"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tenantId) params["tenantId.equals"] = String(tenantId);
      const { data } = await axiosClient.get<TenantSettings[]>("/api/tenant-settings", {
        params,
      });
      return data;
    },
  });
}

// --- TenantProfile ---

export interface TenantProfile {
  id: number;
  sector: string | null;
  maturityLevel: string | null;
  primaryGoal: string | null;
  attributes: string | null; // @Lob
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export function useTenantProfiles(tenantId?: number) {
  return useQuery({
    queryKey: ["admin", "profiles", tenantId ?? "all"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tenantId) params["tenantId.equals"] = String(tenantId);
      const { data } = await axiosClient.get<TenantProfile[]>("/api/tenant-profiles", {
        params,
      });
      return data;
    },
  });
}

// --- TenantPlan (quota) ---

export interface TenantPlanQuota {
  id: number;
  planName: string;
  monthlyTokenLimit: number | null;
  monthlyRequestLimit: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export function useTenantPlans(tenantId?: number) {
  return useQuery({
    queryKey: ["admin", "plans", tenantId ?? "all"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tenantId) params["tenantId.equals"] = String(tenantId);
      const { data } = await axiosClient.get<TenantPlanQuota[]>("/api/tenant-plans", {
        params,
      });
      return data;
    },
  });
}

export function usePatchTenantPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number } & Partial<TenantPlanQuota>) => {
      const { id, ...body } = input;
      const { data } = await axiosClient.patch<TenantPlanQuota>(
        `/api/tenant-plans/${id}`,
        body,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });
}

// --- TenantBranding ---

export interface TenantBranding {
  id: number;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  theme: string | null;
  displayName: string | null;
  customPrompts: string | null; // @Lob
  updatedAt: string;
  tenant: TenantRef;
}

export function useTenantBrandings(tenantId?: number) {
  return useQuery({
    queryKey: ["admin", "brandings", tenantId ?? "all"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tenantId) params["tenantId.equals"] = String(tenantId);
      const { data } = await axiosClient.get<TenantBranding[]>("/api/tenant-brandings", {
        params,
      });
      return data;
    },
  });
}

// --- TenantMemory ---

export interface TenantMemory {
  id: number;
  category: string;
  key: string;
  value: string | null; // @Lob
  confidenceScore: number;
  source: string;
  hitCount: number;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export function useTenantMemories(category?: string, tenantId?: number) {
  return useQuery({
    queryKey: ["admin", "memories", { category, tenantId }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (category) params["category.equals"] = category;
      if (tenantId) params["tenantId.equals"] = String(tenantId);
      const { data } = await axiosClient.get<TenantMemory[]>("/api/tenant-memories", {
        params,
      });
      return data;
    },
  });
}

export function useDeleteTenantMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/tenant-memories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "memories"] }),
  });
}

// --- Utilitaire ---

// Parse défensivement un @Lob contenant un objet JSON. Renvoie null si absent/mal formé.
export function parseAdminJsonObject(
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