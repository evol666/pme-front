import axiosClient from "@/api/axiosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Hooks API pour le Copilote IA.
// Backend Spring Boot : CopilotResource (/api/copilot). Les DTOs sont des records
// Java dont les composants sont nommés en snake_case (action_id, generated_at,
// elapsed_ms, job_id, metier_id...) — Jackson sérialise les records tels quels,
// donc le wire est en snake_case. Aucune conversion de cas côté front (cf.
// axiosClient : seul le path est réécrit /api -> /services/pme/api).
//
// Endpoints couverts :
//  - GET  /api/copilot/state              -> suggestions + insights + priorités
//  - POST /api/copilot/converse           -> réponse IA (text, model, mock)
//  - GET  /api/copilot/health              -> statut Ollama (reachable, model...)
//  - POST /api/copilot/v2/alerts/{id}/seen|act|dismiss|snooze -> actions alertes
//
// Chat persistant (inspiré du chatbot GED) :
//  - GET  /api/copilot/chats              -> liste des conversations
//  - POST /api/copilot/chats              -> créer une conversation
//  - GET  /api/copilot/chats/{id}         -> détail conversation
//  - PUT  /api/copilot/chats/{id}         -> renommer
//  - PUT  /api/copilot/chats/{id}/archive -> archiver
//  - PUT  /api/copilot/chats/{id}/unarchive -> désarchiver
//  - GET  /api/copilot/chats/{id}/messages -> historique messages
//  - POST /api/copilot/chats/{id}/messages -> envoyer un message (IA répond + persiste)

// --- Types (match exact avec le wire backend, snake_case) ---

export interface CopilotAction {
  action_id: string;
  label: string;
  kind: string;
  payload: Record<string, unknown>;
}

export interface CopilotSuggestion {
  id: string;
  kind: string;
  title: string;
  summary: string;
  priority: number | null;
  action: CopilotAction;
  severity: string;
  reasons: string[];
  sources: Array<Record<string, unknown>>;
}

export interface CopilotInsight {
  id: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  confidence: number | null;
  reasons: string[];
  sources: Array<Record<string, unknown>>;
  suggested_action: Record<string, unknown>;
  metier_id: string | null;
  created_at: string;
}

export interface CopilotState {
  suggestions: CopilotSuggestion[];
  insights: CopilotInsight[];
  priorities: CopilotSuggestion[];
  generated_at: string;
  elapsed_ms: number;
  backend: string;
}

export interface ConverseMessage {
  role: string;
  content: string;
}

export interface ConverseRequest {
  message: string;
  history: ConverseMessage[];
  job_id?: string;
  metier_id?: string;
  temperature?: number;
}

export interface CopilotReply {
  text: string;
  actions: CopilotAction[];
  sources: Array<Record<string, unknown>>;
  insights: CopilotInsight[];
  duration_ms: number;
  model: string;
  mock: boolean;
}

export interface CopilotHealth {
  ollama_reachable: boolean;
  model: string;
  model_available: boolean;
  mock: boolean;
  latency_ms: number;
}

export type AlertAction = "seen" | "act" | "dismiss" | "snooze";

// --- Query Keys ---

export const copilotKeys = {
  all: ["copilot"] as const,
  state: (params: {
    maxSuggestions?: number;
    maxInsights?: number;
    jobId?: string;
    metierId?: string;
  }) => ["copilot", "state", params] as const,
  health: ["copilot", "health"] as const,
};

// --- Hooks ---

export function useCopilotState(params: {
  maxSuggestions?: number;
  maxInsights?: number;
  jobId?: string;
  metierId?: string;
} = {}) {
  return useQuery({
    queryKey: copilotKeys.state(params),
    queryFn: async () => {
      const { data } = await axiosClient.get<CopilotState>("/api/copilot/state", {
        params: {
          max_suggestions: params.maxSuggestions,
          max_insights: params.maxInsights,
          job_id: params.jobId,
          metier_id: params.metierId,
        },
      });
      return data;
    },
  });
}

// Santé Ollama : on sonde toutes les 30s pour refléter la disponibilité du modèle
// sans spammer le backend.
export function useCopilotHealth(enabled = true) {
  return useQuery({
    queryKey: copilotKeys.health,
    enabled,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await axiosClient.get<CopilotHealth>("/api/copilot/health");
      return data;
    },
  });
}

export function useCopilotConverse() {
  return useMutation({
    mutationFn: async (request: ConverseRequest) => {
      const { data } = await axiosClient.post<CopilotReply>(
        "/api/copilot/converse",
        request,
      );
      return data;
    },
  });
}

// ─── Chat persistant ──────────────────────────────────────────────────────────

export interface CopilotChat {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  lastActivity: string;
}

export interface CopilotChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  message: string;
  createdDate: string;
}

export const chatKeys = {
  all: ["copilot", "chats"] as const,
  list: () => ["copilot", "chats", "list"] as const,
  detail: (id: string) => ["copilot", "chats", id] as const,
  messages: (id: string) => ["copilot", "chats", id, "messages"] as const,
};

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: async () => {
      const { data } = await axiosClient.get<CopilotChat[]>("/api/copilot/chats");
      return data ?? [];
    },
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const { data } = await axiosClient.post<CopilotChat>("/api/copilot/chats", { title });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useUpdateChatTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, title }: { chatId: string; title: string }) => {
      const { data } = await axiosClient.put<CopilotChat>(`/api/copilot/chats/${chatId}`, { title });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useArchiveChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      await axiosClient.put(`/api/copilot/chats/${chatId}/archive`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useUnarchiveChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      await axiosClient.put(`/api/copilot/chats/${chatId}/unarchive`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(chatId ?? ""),
    enabled: !!chatId,
    queryFn: async () => {
      const { data } = await axiosClient.get<CopilotChatMessage[]>(
        `/api/copilot/chats/${chatId}/messages`,
      );
      return data ?? [];
    },
  });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, message, temperature }: { chatId: string; message: string; temperature?: number }) => {
      const { data } = await axiosClient.post<CopilotChatMessage>(
        `/api/copilot/chats/${chatId}/messages`,
        { message, temperature },
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

// Actions sur une alerte (insight). Invalide le state copilote pour recharger
// la liste filtrée (l'alerte acquittée change de statut côté backend).
export function useAlertAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      alertId: number;
      action: AlertAction;
      days?: number;
    }) => {
      const url = `/api/copilot/v2/alerts/${params.alertId}/${params.action}`;
      if (params.action === "snooze") {
        const { data } = await axiosClient.post(url, { days: params.days ?? 3 });
        return data;
      }
      const { data } = await axiosClient.post(url);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: copilotKeys.all }),
  });
}