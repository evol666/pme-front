import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API pour les priorités stratégiques utilisateur (Mission-control).
//
// Hybride volontaire :
//  - LISTE / DELETE / STATUS : CRUD standard JHipster /api/user-priorities (DTOs
//    complets UserPriorityDTO, camelCase). La lecture n'a pas besoin d'injecter
//    tenant/user (déjà peuplés côté backend).
//  - CREATE : POST /api/copilot/v2/priorities. Le POST standard exigerait tenant
//    et user (@NotNull sur le DTO) sans que le client ne dispose de ces IDs ;
//    l'endpoint copilot v2 les injecte depuis TenantContext/SecurityUtils (vérifié
//    dans CopilotResource.createV2Priority). On invalide ensuite la liste qui
//    remonte le DTO complet.

// --- Types ---

export type UserPriorityKind = "GOAL" | "FOCUS" | "INTENT";
export type UserPriorityHorizon = "WEEK" | "MONTH" | "QUARTER" | "YEAR";
export type UserPriorityStatus = "active" | "achieved" | "dropped";

export interface UserPriority {
  id: number;
  kind: UserPriorityKind;
  label: string | null;
  weight: number;
  horizon: UserPriorityHorizon;
  source: string;
  metadata: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenant: { id: number } | null;
  user: { id: number } | null;
}

// Corps de création attendu par /api/copilot/v2/priorities (record PriorityCreate).
export interface PriorityCreateInput {
  label: string;
  kind: UserPriorityKind;
  horizon: UserPriorityHorizon;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface PriorityCreateResult {
  id: number;
  label: string;
  weight: number;
  kind: string;
  horizon: string;
  status: string;
}

// --- Query Keys ---

export const prioritiesKeys = {
  all: ["priorities"] as const,
  list: (status?: string) => ["priorities", "list", { status }] as const,
};

// --- Hooks ---

export function useUserPriorities(status?: UserPriorityStatus) {
  return useQuery({
    queryKey: prioritiesKeys.list(status),
    queryFn: async () => {
      // Critère JHipster : status.equals=<value>. Sans statut on remonte tout.
      const params = status ? { "status.equals": status } : undefined;
      const { data } = await axiosClient.get<UserPriority[]>(
        "/api/user-priorities",
        { params },
      );
      return data;
    },
  });
}

export function useCreatePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PriorityCreateInput) => {
      const { data } = await axiosClient.post<PriorityCreateResult>(
        "/api/copilot/v2/priorities",
        input,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: prioritiesKeys.all }),
  });
}

// Mise à jour du statut via PATCH partiel JHipster (merge-patch+json) : on ne
// renvoie que l'id + le statut, les champs null sont ignorés côté backend.
export function useUpdatePriorityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: number; status: UserPriorityStatus }) => {
      const { data } = await axiosClient.patch<UserPriority>(
        `/api/user-priorities/${params.id}`,
        { id: params.id, status: params.status },
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: prioritiesKeys.all }),
  });
}

export function useDeletePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/user-priorities/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: prioritiesKeys.all }),
  });
}