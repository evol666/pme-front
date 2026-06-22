import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API Personas IA (LOT personnalités utilisateur). Version Spring Boot CRUD.
// Backend : UserPersonaResource (/api/user-personas) — POST "", GET "", GET /count,
// GET /{id}, DELETE /{id}. Pas de hook d'update côté frontend (convention LOT :
// backend expose PUT/PATCH mais on ne les consomme pas ici).
// Voir [[pme-migration-status]].

// DTOs Spring Boot en camelCase (naming strategy Jackson standard). Les champs @Lob
// (goals, preferences) sont des chaînes (JSON sérialisé pour les objets/tableaux).

interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
}

interface AppUserRef {
  id: number;
  login?: string | null;
  email?: string | null;
}

export interface UserPersona {
  id: number;
  role: string | null; // max 64
  goals: string | null; // @Lob : objet JSON sérialisé
  preferences: string | null; // @Lob : objet JSON sérialisé
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
  user: AppUserRef;
}

// Payload de création : on n'envoie que les champs éditables. Le backend résout
// tenant/user depuis le contexte JWT et pose createdAt/updatedAt.
export interface CreateUserPersonaInput {
  role: string;
  goals?: string | null;
  preferences?: string | null;
}

// --- Query Keys ---

export const personasKeys = {
  all: ["personas"] as const,
  list: (role?: string) => ["personas", "list", { role }] as const,
};

// --- Liste (GET /api/user-personas, non paginé — retourne List<UserPersonaDTO>) ---

export function usePersonas(role?: string) {
  return useQuery({
    queryKey: personasKeys.list(role),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (role) params["role.contains"] = role;
      const { data } = await axiosClient.get<UserPersona[]>("/api/user-personas", {
        params,
      });
      return data;
    },
  });
}

// --- Création (POST /api/user-personas) ---

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserPersonaInput) => {
      const { data } = await axiosClient.post<UserPersona>("/api/user-personas", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: personasKeys.all }),
  });
}

// --- Suppression (DELETE /api/user-personas/{id}) ---

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/user-personas/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: personasKeys.all }),
  });
}

// --- Utilitaire ---

// Parse défensivement un @Lob contenant un objet JSON. Renvoie null si absent
// ou mal formé — pour affichage lisible des goals/preferences.
export function parsePersonaJsonObject(
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