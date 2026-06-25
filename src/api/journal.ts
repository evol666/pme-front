import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API pour le journal d'événements.
// Backend Spring Boot : JournalEventResource (/api/journal-events), CRUD JHipster
// standard avec Criteria + Pageable. Réponses en camelCase (naming strategy
// Jackson par défaut). Pagination via header X-Total-Count.

// --- Types (match exact avec le wire backend, camelCase) ---

export interface JournalEvent {
  id: number;
  kind: string;
  title: string;
  content: string | null;
  occurredAt: string;
  createdAt: string;
  siren: string | null;
  tenant: { id: number } | null;
  user: { id: number } | null;
}

export interface JournalListParams {
  page?: number;
  size?: number;
  sort?: string;
  kind?: string;
  siren?: string;
}

export interface JournalListResult {
  items: JournalEvent[];
  total: number;
}

// --- Query Keys ---

export const journalKeys = {
  all: ["journal"] as const,
  list: (params: JournalListParams) => ["journal", "list", params] as const,
};

// --- Hooks ---

export function useJournalEvents(params: JournalListParams = {}) {
  const page = params.page ?? 0;
  const size = params.size ?? 25;
  const sort = params.sort ?? "occurredAt,desc";
  return useQuery({
    queryKey: journalKeys.list({ page, size, sort, kind: params.kind, siren: params.siren }),
    queryFn: async () => {
      // Critère JHipster : kind.equals=<value>. Sans kind on remonte tout.
      const requestParams: Record<string, unknown> = { page, size, sort };
      if (params.kind) requestParams["kind.equals"] = params.kind;
      if (params.siren) requestParams["siren.equals"] = params.siren;
      const response = await axiosClient.get<JournalEvent[]>(
        "/api/journal-events",
        { params: requestParams },
      );
      const total = Number(response.headers?.["x-total-count"] ?? 0);
      return { items: response.data, total } satisfies JournalListResult;
    },
  });
}

export function useDeleteJournalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/journal-events/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: journalKeys.all }),
  });
}