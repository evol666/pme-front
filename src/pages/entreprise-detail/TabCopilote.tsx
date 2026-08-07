import { Bot, CircleDot, Loader2, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAnalyses } from "@/api/analyses";
import { type ConverseMessage, useCopilotConverse, useCopilotHealth } from "@/api/copilot";
import { cn } from "@/lib/utils";
import type { CopilotChatMessage, CopilotSource, TabId } from "./types";

// Onglet Copilote : conversation contextualisée par la dernière analyse de
// l'entreprise. Les sources renvoyées ouvrent le module ou l'onglet visé.

// Classe de la bulle de message du copilote selon l'auteur/l'état — table de
// correspondance plutôt que ternaires imbriquées.
export function copilotBubbleClass(message: CopilotChatMessage): string {
	if (message.role === "user") return "bg-primary text-primary-foreground rounded-br-md";
	if (message.error) return "bg-red-500/10 text-red-600 border border-red-500/20 rounded-bl-md";
	return "bg-accent text-foreground rounded-bl-md";
}

export function sourceLabel(src: CopilotSource): string {
	const label = src.label;
	if (typeof label === "string" && label) return label;
	const type = src.type;
	if (type === "module") return "Module";
	if (type === "tab") return "Onglet";
	return "Source";
}

export function TabCopilote({
	siren,
	raisonSociale,
	goTo,
}: {
	readonly siren: string;
	readonly raisonSociale: string;
	readonly goTo: (id: TabId, module?: string) => void;
}) {
	const converse = useCopilotConverse();
	const { data: health } = useCopilotHealth();
	const { data: analyses } = useAnalyses(siren);

	// Dernière analyse du SIREN : fournit le job_id et le métier détecté au copilote
	// pour qu'il charge le contexte riche (entreprise + modules + diagnostic).
	const lastAnalysis = (analyses ?? [])[0];
	const jobId = lastAnalysis?.job_id ?? undefined;
	const metierId = lastAnalysis?.detected_business_id ?? undefined;

	const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
	const [input, setInput] = useState("");

	const handleSend = async () => {
		const message = input.trim();
		if (!message || converse.isPending) return;

		const history: ConverseMessage[] = messages.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		setMessages((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: "user", content: message },
		]);
		setInput("");

		try {
			const reply = await converse.mutateAsync({
				message,
				history,
				job_id: jobId,
				metier_id: metierId,
				temperature: 0.4,
			});
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: reply.text,
					sources: reply.sources,
				},
			]);
		} catch (err) {
			const axiosErr = err as {
				response?: {
					data?: { error?: { message?: string } };
					statusText?: string;
				};
			};
			const msg =
				axiosErr?.response?.data?.error?.message ??
				axiosErr?.response?.statusText ??
				"Le copilote ne répond pas pour le moment.";
			setMessages((prev) => [
				...prev,
				{ id: crypto.randomUUID(), role: "assistant", content: msg, error: true },
			]);
		}
	};

	const onSourceClick = (src: CopilotSource) => {
		const type = src.type;
		if (type === "module") {
			const moduleId = src.moduleId;
			if (typeof moduleId === "string" && moduleId) goTo("modules", moduleId);
		} else if (type === "tab") {
			const tab = src.tab;
			if (typeof tab === "string" && tab) goTo(tab as TabId);
		}
	};

	let healthToneClass = "bg-red-500/10 text-red-600 border-red-500/20";
	let healthLabel = "Hors ligne";
	if (health?.ollama_reachable && !health?.mock) {
		healthToneClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
		healthLabel = "En ligne";
	} else if (health?.mock) {
		healthToneClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
		healthLabel = "Mode démo";
	}

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-sm font-semibold text-foreground flex items-center gap-2">
						<Bot className="w-4 h-4 text-primary" />
						Copilote IA — {raisonSociale}
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						Contexte : entreprise, métier détecté
						{metierId ? ` (${metierId})` : ""}, modules disponibles et dernière
						analyse. Les sources renvoyées ouvrent le module ou l'onglet
						pertinent.
					</p>
				</div>
				<span
					className={cn(
						"inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap",
						healthToneClass,
					)}
				>
					{healthLabel}
				</span>
			</div>

			<section className="flex flex-col bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden h-[480px]">
				<div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
					{messages.length === 0 ? (
						<div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
							<div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
								<Sparkles className="w-6 h-6 text-primary" />
							</div>
							<p className="text-sm font-medium text-foreground">
								Posez votre question
							</p>
							<p className="text-xs text-muted-foreground max-w-xs">
								Ex. « Comment améliorer mes ventes ? », « Quelles actions
								prioritaires ? »
							</p>
						</div>
					) : (
						messages.map((m) => (
							<div
								key={m.id}
								className={cn(
									"flex",
									m.role === "user" ? "justify-end" : "justify-start",
								)}
							>
								<div
									className={cn(
										"max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
										copilotBubbleClass(m),
									)}
								>
									<p className="whitespace-pre-wrap">{m.content}</p>
									{m.role === "assistant" &&
										!m.error &&
										m.sources &&
										m.sources.length > 0 && (
											<div className="mt-2 flex flex-wrap gap-1.5">
												{m.sources.map((src) => (
													<button
														key={sourceLabel(src)}
														type="button"
														onClick={() => onSourceClick(src)}
														className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
													>
														<CircleDot className="w-3 h-3" />
														{sourceLabel(src)}
													</button>
												))}
											</div>
										)}
								</div>
							</div>
						))
					)}
					{converse.isPending && (
						<div className="flex justify-start">
							<div className="bg-accent text-foreground rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="w-4 h-4 animate-spin" />
								Le copilote réfléchit…
							</div>
						</div>
					)}
				</div>

				<div className="border-t border-border/50 p-2.5 flex items-center gap-2">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSend();
							}
						}}
						rows={1}
						placeholder="Écrivez votre message… (Entrée pour envoyer)"
						className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!input.trim() || converse.isPending}
						className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
						title="Envoyer"
					>
						<Send className="w-4 h-4" />
					</button>
				</div>
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Onglet Modules — catalogue modules/outils du métier détecté pour ce SIREN
// ---------------------------------------------------------------------------

// Bundles sectoriels B2B (Lot H — stratégie hybride). La détection NAF renvoie
// le métier artisan fin ; ces bundles restent sélectionnables manuellement pour
// élargir le catalogue au secteur. Les `id` correspondent exactement aux clés
// `profiles` de `pme_modules.json`.


