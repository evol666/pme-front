import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Notifications — migration React 18/FastAPI → React 19/Spring Boot.
// Backend :
//  - NotificationResource (/api/notifications, CRUD JHipster paginé + Criteria)
//  - NotificationCenterResource (/api/notification-center, actions sémantiques
//    read/unread/archive/read-all/refresh + unread-count)
//  - NotificationDigestResource (/api/notification-digests, liste Criteria)
// Les DTO JHipster sont en camelCase. Les champs @Lob (title, body, summary,
// payload, channels) sont des chaînes ; payload et channels contiennent du JSON
// sérialisé à parser défensivement.

// --- Enums (miroir exact du backend) ---

export type NotificationKind = "ALERT" | "NBA" | "DIGEST" | "WORKFLOW";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NotificationStatus =
  | "PENDING"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "DISMISSED"
  | "FAILED"
  | "GROUPED";

// --- DTOs (match exact avec le wire backend, camelCase) ---

export interface TenantRef {
  id: number;
}

export interface AppUserRef {
  id: number;
  login?: string | null;
  email?: string | null;
}

export interface Notification {
  id: number;
  kind: NotificationKind;
  category: string | null;
  priority: NotificationPriority;
  title: string | null; // @Lob
  body: string | null; // @Lob
  summary: string | null; // @Lob
  ctaLabel: string | null;
  ctaUrl: string | null;
  payload: string | null; // @Lob JSON
  channels: string | null; // @Lob JSON
  status: NotificationStatus;
  groupKey: string | null;
  relatedAlertId: string | null;
  relatedActionId: string | null;
  scheduledAt: string | null;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  tenant: TenantRef;
  user: AppUserRef | null;
}

export interface NotificationDigest {
  id: number;
  kind: string;
  periodStart: string | null;
  periodEnd: string | null;
  subject: string | null; // @Lob
  summary: string | null; // @Lob
  highlights: string | null; // @Lob JSON
  stats: string | null; // @Lob JSON
  channels: string | null; // @Lob JSON
  status: string;
  createdAt: string;
  sentAt: string | null;
  tenant: TenantRef;
  user: AppUserRef | null;
}

export interface NotificationListParams {
  page?: number;
  size?: number;
  sort?: string;
  status?: NotificationStatus;
  kind?: NotificationKind;
  priority?: NotificationPriority;
  category?: string;
  search?: string;
}

export interface NotificationListResult {
  items: Notification[];
  total: number;
}

export interface UnreadCount {
  unreadCount: number;
}

// --- Query Keys ---

export const notificationsKeys = {
  all: ["notifications"] as const,
  list: (params: NotificationListParams) =>
    ["notifications", "list", params] as const,
  digests: () => ["notifications", "digests"] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
};

// --- Hooks liste paginée (NotificationResource) ---

export function useNotifications(params: NotificationListParams = {}) {
  const page = params.page ?? 0;
  const size = params.size ?? 25;
  const sort = params.sort ?? "createdAt,desc";
  return useQuery({
    queryKey: notificationsKeys.list({ page, size, sort, ...params }),
    queryFn: async () => {
      const requestParams: Record<string, unknown> = { page, size, sort };
      // Criteria JHipster : filtres exacts sur enum/chaîne.
      if (params.status) requestParams["status.equals"] = params.status;
      if (params.kind) requestParams["kind.equals"] = params.kind;
      if (params.priority) requestParams["priority.equals"] = params.priority;
      if (params.category) requestParams["category.equals"] = params.category;
      // Recherche libre sur le titre (contains).
      if (params.search) requestParams["title.contains"] = params.search;
      const response = await axiosClient.get<Notification[]>(
        "/api/notifications",
        { params: requestParams },
      );
      const total = Number(response.headers?.["x-total-count"] ?? 0);
      return { items: response.data, total } satisfies NotificationListResult;
    },
  });
}

// --- Hooks digests (NotificationDigestResource) ---

export function useNotificationDigests() {
  return useQuery({
    queryKey: notificationsKeys.digests(),
    queryFn: async () => {
      const { data } = await axiosClient.get<NotificationDigest[]>(
        "/api/notification-digests",
      );
      // Trie par createdAt desc (l'endpoint n'est pas paginé).
      return [...data].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    },
  });
}

// --- Compteur non lues (NotificationCenterResource) ---

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: async () => {
      const { data } = await axiosClient.get<Record<string, number>>(
        "/api/notification-center/unread-count",
      );
      return { unreadCount: data?.unread_count ?? 0 } satisfies UnreadCount;
    },
    refetchInterval: 60_000,
  });
}

// --- Mutations ---

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      // PATCH merge-patch sur NotificationResource : status=READ + readAt now.
      await axiosClient.patch(
        `/api/notifications/${id}`,
        { id, status: "READ", readAt: new Date().toISOString() },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useMarkNotificationUnread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      // PATCH merge-patch : status=SENT (non lu) + readAt null.
      await axiosClient.patch(
        `/api/notifications/${id}`,
        { id, status: "SENT", readAt: null },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      // PATCH merge-patch : status=DISMISSED + dismissedAt now.
      await axiosClient.patch(
        `/api/notifications/${id}`,
        {
          id,
          status: "DISMISSED",
          dismissedAt: new Date().toISOString(),
        },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/notifications/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axiosClient.post("/api/notification-center/read-all");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useRefreshNotificationCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axiosClient.post("/api/notification-center/refresh");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

// --- Utilitaires ---

// Parse défensivement un @Lob contenant un tableau JSON (ex. channels).
// Renvoie [] si absent ou mal formé.
export function parseNotificationChannels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Parse défensivement un @Lob contenant un objet JSON (ex. payload, highlights, stats).
// Renvoie null si absent ou mal formé.
export function parseNotificationJson(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}