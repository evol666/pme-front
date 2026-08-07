import {
	BarChart3,
	BookOpen,
	Building2,
	FileText,
	LayoutGrid,
	Lightbulb,
	PiggyBank,
	Sparkles,
	Workflow,
} from "lucide-react";
import type { PmeModuleDTO, PmeToolDTO } from "@/api/metiers";

// Définition des onglets de la fiche entreprise et types partagés entre les
// panneaux. Isolés ici pour éviter que chaque panneau ne dépende de la page.

export const TABS = [
	{ id: "identite", label: "Identité", icon: Building2 },
	{ id: "finances", label: "Finances", icon: PiggyBank },
	{ id: "analyses", label: "Analyses", icon: BarChart3 },
	{ id: "recommandations", label: "Recommandations", icon: Lightbulb },
	{ id: "modules", label: "Modules", icon: LayoutGrid },
	{ id: "documents", label: "Documents", icon: FileText },
	{ id: "journal", label: "Journal", icon: BookOpen },
	{ id: "copilote", label: "Copilote IA", icon: Sparkles },
	{ id: "playbooks", label: "Playbooks", icon: Workflow },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export type CatalogItem = PmeModuleDTO | PmeToolDTO;

export type CopilotSource = Record<string, unknown>;

export interface CopilotChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	sources?: CopilotSource[];
	error?: boolean;
}
