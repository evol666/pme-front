import axiosClient from "@/api/axiosClient";
import { useQuery } from "@tanstack/react-query";

// Hooks API gouvernance IA (LOT conformité / audit / coûts / traces). Version Spring Boot.
// Backend : AiAuditEntryResource (/api/ai-audit-entries — paginé via Criteria + Pageable),
// AiTraceResource (/api/ai-traces — paginé), AiCostResource (/api/ai-costs — paginé,
// rollup quotidien par provider/modèle).
// JHipster renvoie le contenu dans le body (List<T>) et le total via l'en-tête X-Total-Count.

// --- Types communs ---

interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
  plan?: string | null;
  status?: string | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

// --- AiAuditEntry (journal d'audit gouvernance) ---

export interface AiAuditEntry {
  id: number;
  kind: string;
  actor: string | null;
  subject: string | null;
  summary: string | null; // @Lob
  payload: string | null; // @Lob
  createdAt: string;
  tenant: TenantRef;
}

export interface AiAuditEntryFilters {
  kind?: string;
  actorContains?: string;
  subjectContains?: string;
  tenantId?: number;
  page: number;
  size: number;
  sort: string;
}

export function useAiAuditEntries(filters: AiAuditEntryFilters) {
  return useQuery({
    queryKey: ["gouvernance", "audit", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(filters.page),
        size: String(filters.size),
        sort: filters.sort,
      };
      if (filters.kind) params["kind.equals"] = filters.kind;
      if (filters.actorContains) params["actor.contains"] = filters.actorContains;
      if (filters.subjectContains) params["subject.contains"] = filters.subjectContains;
      if (filters.tenantId) params["tenantId.equals"] = String(filters.tenantId);
      const response = await axiosClient.get<AiAuditEntry[]>("/api/ai-audit-entries", {
        params,
      });
      const total = Number(response.headers["x-total-count"] ?? response.data.length);
      return { items: response.data, total } satisfies PageResult<AiAuditEntry>;
    },
    placeholderData: (prev) => prev,
  });
}

// --- AiTrace (trace fine d'appel IA) ---

export interface AiTrace {
  id: number;
  sessionId: string | null;
  provider: string;
  model: string;
  operation: string;
  status: string;
  latencyMs: number | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  agentId: string | null;
  runId: string | null;
  fallbackUsed: boolean;
  errorKind: string | null;
  attributes: string | null; // @Lob
  createdAt: string;
  tenant: TenantRef;
}

export interface AiTraceFilters {
  provider?: string;
  model?: string;
  operation?: string;
  status?: string;
  sessionId?: string;
  tenantId?: number;
  page: number;
  size: number;
  sort: string;
}

export function useAiTraces(filters: AiTraceFilters) {
  return useQuery({
    queryKey: ["gouvernance", "traces", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(filters.page),
        size: String(filters.size),
        sort: filters.sort,
      };
      if (filters.provider) params["provider.equals"] = filters.provider;
      if (filters.model) params["model.equals"] = filters.model;
      if (filters.operation) params["operation.equals"] = filters.operation;
      if (filters.status) params["status.equals"] = filters.status;
      if (filters.sessionId) params["sessionId.equals"] = filters.sessionId;
      if (filters.tenantId) params["tenantId.equals"] = String(filters.tenantId);
      const response = await axiosClient.get<AiTrace[]>("/api/ai-traces", { params });
      const total = Number(response.headers["x-total-count"] ?? response.data.length);
      return { items: response.data, total } satisfies PageResult<AiTrace>;
    },
    placeholderData: (prev) => prev,
  });
}

// --- AiCost (rollup quotidien par tenant / provider / modèle) ---

export interface AiCost {
  id: number;
  day: string; // LocalDate (ISO yyyy-mm-dd)
  provider: string;
  model: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  tenant: TenantRef;
}

export interface AiCostFilters {
  provider?: string;
  model?: string;
  day?: string; // ISO yyyy-mm-dd
  tenantId?: number;
  page: number;
  size: number;
  sort: string;
}

export function useAiCosts(filters: AiCostFilters) {
  return useQuery({
    queryKey: ["gouvernance", "costs", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(filters.page),
        size: String(filters.size),
        sort: filters.sort,
      };
      if (filters.provider) params["provider.equals"] = filters.provider;
      if (filters.model) params["model.equals"] = filters.model;
      if (filters.day) params["day.equals"] = filters.day;
      if (filters.tenantId) params["tenantId.equals"] = String(filters.tenantId);
      const response = await axiosClient.get<AiCost[]>("/api/ai-costs", { params });
      const total = Number(response.headers["x-total-count"] ?? response.data.length);
      return { items: response.data, total } satisfies PageResult<AiCost>;
    },
    placeholderData: (prev) => prev,
  });
}

// --- Agrégation coûts par provider (calcul côté client sur la page courante) ---

export interface CostByProvider {
  provider: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export function aggregateCostsByProvider(items: AiCost[]): CostByProvider[] {
  const map = new Map<string, CostByProvider>();
  for (const c of items) {
    const cur = map.get(c.provider) ?? {
      provider: c.provider,
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    };
    cur.calls += c.calls;
    cur.tokensIn += c.tokensIn;
    cur.tokensOut += c.tokensOut;
    cur.costUsd += c.costUsd;
    map.set(c.provider, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.costUsd - a.costUsd);
}

// --- Utilitaire ---

// Parse défensivement un @Lob contenant un objet JSON. Renvoie null si absent/mal formé.
export function parseGouvernanceJsonObject(
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