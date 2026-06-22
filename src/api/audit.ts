import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API pour le journal d'audit (AuditLogResource /api/audit-logs).
// Backend Spring Boot JHipster : GET paginé + Criteria + Pageable, header
// X-Total-Count (PaginationUtil). Réponses camelCase (Jackson naming strategy
// par défaut). @Lob sur details => JSON string à parser défensivement côté client.
// Criteria disponible : action.equals, resourceKind.equals, status.equals,
// userId.equals, createdAt.* (InstantFilter). Pas de recherche textuelle libre
// côté backend — la recherche par utilisateur passe par userId.equals.

// --- Types (match exact avec le wire backend, camelCase) ---

export interface AuditLogTenant {
  id: number;
}

export interface AuditLogUser {
  id: number;
  // Les champs suivants sont optionnels : selon AppUserDTO, on peut avoir
  // email/login/firstName/lastName. On reste défensif.
  email?: string;
  login?: string;
  firstName?: string;
  lastName?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  resourceKind: string | null;
  resourceId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  details: string | null; // @Lob : JSON string potentiellement parsable
  createdAt: string;
  tenant: AuditLogTenant | null;
  user: AuditLogUser | null;
}

export interface AuditLogListParams {
  page?: number;
  size?: number;
  sort?: string;
  action?: string;
  resourceKind?: string;
  status?: string;
  userId?: number;
}

export interface AuditLogListResult {
  items: AuditLog[];
  total: number;
}

// --- Query Keys ---

export const auditKeys = {
  all: ["audit"] as const,
  lists: () => ["audit", "list"] as const,
  list: (params: AuditLogListParams) => ["audit", "list", params] as const,
  details: () => ["audit", "detail"] as const,
  detail: (id: number) => ["audit", "detail", id] as const,
};

// --- Helpers ---

function extractTotal(headers: Record<string, unknown> | undefined): number {
  // PaginationUtil émet "X-Total-Count"; axios lowercaser les noms de headers.
  const raw = headers?.["x-total-count"] ?? headers?.["X-Total-Count"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return Number(value ?? 0) || 0;
}

// --- Hooks ---

export function useAuditLogs(params: AuditLogListParams = {}) {
  const page = params.page ?? 0;
  const size = params.size ?? 25;
  const sort = params.sort ?? "createdAt,desc";
  return useQuery({
    queryKey: auditKeys.list({
      page,
      size,
      sort,
      action: params.action,
      resourceKind: params.resourceKind,
      status: params.status,
      userId: params.userId,
    }),
    queryFn: async () => {
      // Critères JHipster : <field>.equals=<value>. Sans filtre on remonte tout.
      const requestParams: Record<string, unknown> = { page, size, sort };
      if (params.action) requestParams["action.equals"] = params.action;
      if (params.resourceKind) requestParams["resourceKind.equals"] = params.resourceKind;
      if (params.status) requestParams["status.equals"] = params.status;
      if (params.userId != null) requestParams["userId.equals"] = params.userId;
      const response = await axiosClient.get<AuditLog[]>("/api/audit-logs", {
        params: requestParams,
      });
      const total = extractTotal(
        response.headers as Record<string, unknown> | undefined,
      );
      return { items: response.data, total } satisfies AuditLogListResult;
    },
  });
}

export function useAuditLog(id: number | null) {
  return useQuery({
    queryKey: auditKeys.detail(id ?? 0),
    queryFn: async () => {
      if (id == null) return null;
      const response = await axiosClient.get<AuditLog>(`/api/audit-logs/${id}`);
      return response.data;
    },
    enabled: id != null,
  });
}

export function useDeleteAuditLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/audit-logs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: auditKeys.all }),
  });
}