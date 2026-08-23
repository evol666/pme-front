import { Workflow } from "lucide-react";
import { useNavigate } from "react-router";

// Onglet Playbooks : renvoi vers la gestion des automatisations.

export function TabPlaybooks() {
	const navigate = useNavigate();
	return (
		<div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
			<div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
				<Workflow className="w-7 h-7" />
			</div>
			<div>
				<p className="text-sm font-semibold text-foreground">Playbooks</p>
				<p className="text-xs text-muted-foreground mt-1">
					Automatisations et workflows d'action pour cette entreprise.
				</p>
			</div>
			<button type="button"
				onClick={() => navigate("/playbooks")}
				className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
			>
				<Workflow className="w-4 h-4" />
				Gérer les playbooks
			</button>
		</div>
	);
}
