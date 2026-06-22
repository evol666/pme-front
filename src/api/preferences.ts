import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API préférences utilisateur IA (domaine preferences-ia). Version Spring Boot.
// Backend : UserPreferenceResource (/api/user-preferences — liste non paginée, criteria
// userId.equals/preferredTone.equals/uiDensity.equals), NotificationPreferenceResource
// (/api/notification-preferences — liste non paginée, criteria userId.equals + toggles).
// Champs @Lob (preferredModules, preferredOutputs, dashboardLayout, extras,
// categoriesFilter) parsés défensivement côté UI. Édition via PATCH merge-patch+json.
//
// Mapping des 3 axes IA (ton / longueur / niveau_detail) sur les champs du DTO :
//   ton           → preferredTone  (string max 32)
//   longueur      → uiDensity      (string max 16)
//   niveau_detail → extras         (@Lob JSON {"niveau_detail": "..."})

// --- Refs communes ---

export interface UserRef {
  id: number;
  email?: string | null;
  fullName?: string | null;
}

export interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
}

// --- UserPreference ---

export interface UserPreference {
  id: number;
  preferredModules: string | null; // @Lob
  preferredOutputs: string | null; // @Lob
  preferredTone: string | null; // max 32 — ton IA
  uiDensity: string | null; // max 16 — longueur IA
  dashboardLayout: string | null; // @Lob
  extras: string | null; // @Lob — JSON {niveau_detail, ...}
  createdAt: string;
  updatedAt: string;
  user: UserRef;
  tenant: TenantRef | null;
}

export type UserPreferencePatch = Partial<
  Pick<
    UserPreference,
    | "preferredTone"
    | "uiDensity"
    | "extras"
    | "preferredModules"
    | "preferredOutputs"
    | "dashboardLayout"
  >
> & { id: number };

export function useUserPreferences(userId?: number) {
  return useQuery({
    queryKey: ["preferences", "user", { userId }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (userId) params["userId.equals"] = String(userId);
      const { data } = await axiosClient.get<UserPreference[]>(
        "/api/user-preferences",
        { params },
      );
      return data;
    },
  });
}

export function usePatchUserPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UserPreferencePatch) => {
      const { id, ...body } = input;
      const { data } = await axiosClient.patch<UserPreference>(
        `/api/user-preferences/${id}`,
        body,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["preferences", "user"] }),
  });
}

// --- NotificationPreference ---

export type DigestFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
export type MinPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface NotificationPreference {
  id: number;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  webhookEnabled: boolean;
  slackEnabled: boolean;
  teamsEnabled: boolean;
  webhookUrl: string | null;
  slackWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
  emailTo: string | null;
  digestFrequency: string; // DigestFrequency
  digestHourUtc: number;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  minPriority: string; // MinPriority
  categoriesFilter: string | null; // @Lob JSON
  createdAt: string;
  updatedAt: string;
  user: UserRef;
  tenant: TenantRef;
}

export type NotificationPreferencePatch = Partial<
  Pick<
    NotificationPreference,
    | "inAppEnabled"
    | "emailEnabled"
    | "webhookEnabled"
    | "slackEnabled"
    | "teamsEnabled"
    | "webhookUrl"
    | "slackWebhookUrl"
    | "teamsWebhookUrl"
    | "emailTo"
    | "digestFrequency"
    | "digestHourUtc"
    | "quietHoursStart"
    | "quietHoursEnd"
    | "minPriority"
    | "categoriesFilter"
  >
> & { id: number };

export function useNotificationPreferences(userId?: number) {
  return useQuery({
    queryKey: ["preferences", "notification", { userId }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (userId) params["userId.equals"] = String(userId);
      const { data } = await axiosClient.get<NotificationPreference[]>(
        "/api/notification-preferences",
        { params },
      );
      return data;
    },
  });
}

export function usePatchNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NotificationPreferencePatch) => {
      const { id, ...body } = input;
      const { data } = await axiosClient.patch<NotificationPreference>(
        `/api/notification-preferences/${id}`,
        body,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["preferences", "notification"] }),
  });
}

// --- Utilitaires ---

// Parse défensivement un @Lob contenant un objet JSON. Renvoie null si absent/mal formé.
export function parsePreferenceJsonObject(
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

// Sérialise un objet en JSON string pour les champs @Lob. Renvoie null si vide.
export function serializePreferenceJson(obj: Record<string, unknown>): string | null {
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;
  return JSON.stringify(obj);
}