import { create } from "zustand";
import { persist } from "zustand/middleware";

// Store UI pour le persona actif (PersonaSwitcher dans AppHeader).
// Persisté en localStorage pour conserver le choix entre sessions. Le persona
// reste purement client : le backend expose /api/user-personas en lecture/CRUD,
// mais aucun champ "persona actif" n'est stocké côté serveur — l'UI bascule
// l'affichage et les suggestions selon le persona sélectionné.

export interface PersonaState {
  activePersonaId: number | null;
  setActivePersona: (id: number | null) => void;
  clearActivePersona: () => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      activePersonaId: null,
      setActivePersona: (id) => set({ activePersonaId: id }),
      clearActivePersona: () => set({ activePersonaId: null }),
    }),
    { name: "pme-active-persona" },
  ),
);