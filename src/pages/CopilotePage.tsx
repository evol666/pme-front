import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
	AlertTriangle,
	Archive,
	ArchiveRestore,
	Bot,
	CheckCircle2,
	CircleDot,
	Edit2,
	History,
	Loader2,
	Plus,
	RefreshCw,
	Send,
	Sparkles,
	Target,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	type AlertAction,
	type CopilotChat,
	type CopilotInsight,
	type CopilotSuggestion,
	useAlertAction,
	useArchiveChat,
	useChatMessages,
	useChats,
	useCopilotHealth,
	useCopilotState,
	useCreateChat,
	useSendChatMessage,
	useUnarchiveChat,
	useUpdateChatTitle,
} from "@/api/copilot";
import { cn } from "@/lib/utils";

function getHistoryMessage(
	key: string,
	currentIdx: number | null,
	msgs: string[],
): { nextIndex: number | null; text: string } | null {
	if (msgs.length === 0) return null;
	if (key === "ArrowUp") {
		const nextIndex =
			currentIdx === null ? msgs.length - 1 : Math.max(0, currentIdx - 1);
		return { nextIndex, text: msgs[nextIndex] ?? "" };
	}
	if (key === "ArrowDown") {
		if (currentIdx === null) return null;
		if (currentIdx < msgs.length - 1)
			return { nextIndex: currentIdx + 1, text: msgs[currentIdx + 1] ?? "" };
		return { nextIndex: null, text: "" };
	}
	return null;
}

// CopilotePage — assistant IA contextuel avec historique persistant (inspiré du chatbot GED).
// Conversations multi-sessions persistées côté backend via /api/copilot/chats.
// Panneau gauche : historique des conversations (actives / archivées).
// Zone centrale : chat avec l'IA (messages persistés).
// Panneau droit : insights, suggestions, priorités.

const SEVERITY_TONE: Record<string, string> = {
	high: "bg-red-500/10 text-red-600",
	medium: "bg-amber-500/10 text-amber-600",
	low: "bg-emerald-500/10 text-emerald-600",
};

function severityTone(sev: string): string {
	return SEVERITY_TONE[sev?.toLowerCase()] ?? "bg-accent text-muted-foreground";
}

// Classe du badge de santé du copilote — if/else plutôt que ternaires
// imbriquées.
function healthBadgeClass(reachable: boolean, mock: boolean): string {
	if (reachable && !mock) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
	if (mock) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
	return "bg-red-500/10 text-red-600 border-red-500/20";
}

// Libellé du badge de santé du copilote — if/else plutôt que ternaires
// imbriquées.
function healthBadgeLabel(reachable: boolean, mock: boolean): string {
	if (mock) return "Mode démo";
	if (reachable) return "En ligne";
	return "Hors ligne";
}

function HealthBadge() {
	const { data, isLoading } = useCopilotHealth();
	const reachable = data?.ollama_reachable ?? false;
	const mock = data?.mock ?? false;
	const ready = reachable && !mock;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border",
				healthBadgeClass(reachable, mock),
			)}
			title={data ? `Modèle: ${data.model}` : undefined}
		>
			{isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
			{!isLoading && ready && <CheckCircle2 className="w-3 h-3" />}
			{!isLoading && !ready && <AlertTriangle className="w-3 h-3" />}
			{healthBadgeLabel(reachable, mock)}
		</span>
	);
}

function InsightCard({
	insight,
	onAction,
	pending,
}: {
	readonly insight: CopilotInsight;
	readonly onAction: (id: number, action: AlertAction) => void;
	readonly pending: boolean;
}) {
	return (
		<li className="bg-card border border-border/50 rounded-xl p-3 space-y-2 shadow-sm">
			<div className="flex items-center gap-2">
				<span
					className={cn(
						"text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
						severityTone(insight.severity),
					)}
				>
					{insight.type}
				</span>
				{insight.confidence != null && (
					<span className="text-[10px] text-muted-foreground">
						{Math.round(insight.confidence * 100)}%
					</span>
				)}
			</div>
			<h4 className="text-xs font-bold text-foreground">{insight.title}</h4>
			<p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
				{insight.summary}
			</p>
			<div className="flex items-center gap-1.5 pt-0.5">
				<button
					type="button"
					onClick={() => onAction(Number(insight.id), "act")}
					disabled={pending}
					className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 disabled:opacity-50"
				>
					<CheckCircle2 className="w-3 h-3" />
					Agir
				</button>
				<button
					type="button"
					onClick={() => onAction(Number(insight.id), "dismiss")}
					disabled={pending}
					className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
				>
					<X className="w-3 h-3" />
					Écarter
				</button>
			</div>
		</li>
	);
}

// Libellé du type de suggestion — if/else plutôt que ternaires imbriquées.
function suggestionKindLabel(kind: string): string {
	if (kind === "recommendation") return "Reco";
	if (kind === "priority") return "Priorité";
	return kind;
}

function SuggestionRow({ suggestion }: { readonly suggestion: CopilotSuggestion }) {
	const label = suggestionKindLabel(suggestion.kind);
	return (
		<li className="flex items-start gap-2.5 py-2">
			<CircleDot className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
			<div className="min-w-0">
				<div className="flex items-center gap-1.5">
					<span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
						{label}
					</span>
					{suggestion.priority != null && (
						<span className="text-[9px] font-bold text-primary">
							P{suggestion.priority}
						</span>
					)}
				</div>
				<p className="text-xs font-medium text-foreground leading-snug">
					{suggestion.title}
				</p>
			</div>
		</li>
	);
}

// ─── Sidebar historique ───────────────────────────────────────────────────────

function ChatHistorySidebar({
	chats,
	currentChatId,
	showArchived,
	onToggleArchived,
	onNewChat,
	onChatSelect,
	onClose,
	isMobile,
	createPending,
}: {
	readonly chats: CopilotChat[];
	readonly currentChatId: string | null;
	readonly showArchived: boolean;
	readonly onToggleArchived: () => void;
	readonly onNewChat: () => void;
	readonly onChatSelect: (id: string) => void;
	readonly onClose: () => void;
	readonly isMobile: boolean;
	readonly createPending: boolean;
}) {
	const archive = useArchiveChat();
	const unarchive = useUnarchiveChat();
	const visible = showArchived
		? chats.filter((c) => c.archived)
		: chats.filter((c) => !c.archived);

	return (
		<div
			className={cn(
				"flex flex-col bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden",
				isMobile
					? "fixed inset-y-0 left-0 z-50 w-72 rounded-none"
					: "w-64 shrink-0",
			)}
		>
			<div className="flex items-center justify-between p-4 border-b border-border/50">
				<h2 className="text-sm font-semibold">
					{showArchived ? "Archivées" : "Conversations"}
				</h2>
				<div className="flex gap-1">
					<button
						type="button"
						title={showArchived ? "Voir les actives" : "Voir les archivées"}
						onClick={onToggleArchived}
						className={cn(
							"w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors",
							showArchived && "bg-primary/10 text-primary",
						)}
					>
						<Archive className="w-4 h-4" />
					</button>
					{!showArchived && (
						<button
							type="button"
							title="Nouvelle conversation"
							onClick={onNewChat}
							disabled={createPending}
							className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
						>
							{createPending ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Plus className="w-4 h-4" />
							)}
						</button>
					)}
					{isMobile && (
						<button
							type="button"
							onClick={onClose}
							className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent"
						>
							<X className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
				{visible.length === 0 && (
					<p className="text-xs text-muted-foreground text-center py-8">
						{showArchived
							? "Aucune conversation archivée."
							: "Aucune conversation. Cliquez sur + pour commencer."}
					</p>
				)}
				{visible.map((chat) => (
					<div
						key={chat.id}
						className={cn(
							"group flex items-start gap-2 w-full rounded-xl px-3 py-2.5 transition-colors",
							currentChatId === chat.id ? "bg-primary/10" : "hover:bg-accent",
						)}
					>
						<button
							type="button"
							className="flex items-start gap-2 flex-1 min-w-0 text-left cursor-pointer bg-transparent"
							onClick={() => {
								onChatSelect(chat.id);
								if (isMobile) onClose();
							}}
						>
							<Bot className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
							<div className="flex-1 min-w-0">
								<p className="text-xs font-medium truncate text-foreground">
									{chat.title}
								</p>
								<p className="text-[10px] text-muted-foreground">
									{format(new Date(chat.lastActivity), "d MMM HH:mm", {
										locale: fr,
									})}
								</p>
							</div>
						</button>
						<button
							type="button"
							title={showArchived ? "Désarchiver" : "Archiver"}
							className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-primary transition-all shrink-0"
							onClick={(e) => {
								e.stopPropagation();
								if (showArchived) unarchive.mutate(chat.id);
								else archive.mutate(chat.id);
							}}
						>
							{showArchived ? (
								<ArchiveRestore className="w-3.5 h-3.5" />
							) : (
								<Archive className="w-3.5 h-3.5" />
							)}
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CopilotePage() {
	const {
		data: state,
		isLoading: stateLoading,
		refetch,
		isFetching,
	} = useCopilotState({ maxSuggestions: 6, maxInsights: 5 });
	const alertAction = useAlertAction();

	const { data: chats = [], isLoading: chatsLoading } = useChats();
	const createChat = useCreateChat();
	const sendMessage = useSendChatMessage();
	const updateTitle = useUpdateChatTitle();

	const [currentChatId, setCurrentChatId] = useState<string | null>(null);
	const [showArchived, setShowArchived] = useState(false);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [input, setInput] = useState("");
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [newTitle, setNewTitle] = useState("");

	const { data: messages = [], isLoading: messagesLoading } =
		useChatMessages(currentChatId);
	const scrollRef = useRef<HTMLDivElement>(null);
	const historyIndexRef = useRef<number | null>(null);

	// Messages envoyés par l'utilisateur (pour la navigation ↑/↓)
	const userMessageTexts = useMemo(
		() => messages.filter((m) => m.role === "user").map((m) => m.message),
		[messages],
	);

	const insights = useMemo(() => state?.insights ?? [], [state]);
	const suggestions = useMemo(() => state?.suggestions ?? [], [state]);
	const priorities = useMemo(() => state?.priorities ?? [], [state]);

	const currentChat = chats.find((c) => c.id === currentChatId);

	// Scroll to bottom when messages change
	useEffect(() => {
		scrollRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, sendMessage.isPending]);

	// Detect mobile
	useEffect(() => {
		const mq = globalThis.matchMedia("(max-width: 768px)");
		setIsMobile(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	// Auto-select first non-archived chat on load
	useEffect(() => {
		if (!currentChatId && chats.length > 0) {
			const first = chats.find((c) => !c.archived);
			if (first) setCurrentChatId(first.id);
		}
	}, [chats, currentChatId]);

	// Close mobile history overlay on Escape
	useEffect(() => {
		if (!isMobile || !isHistoryOpen) return;
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setIsHistoryOpen(false);
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isMobile, isHistoryOpen]);

	const handleNewChat = async () => {
		const chat = await createChat.mutateAsync("Nouvelle conversation");
		setCurrentChatId(chat.id);
		setShowArchived(false);
	};

	const handleSend = async () => {
		const message = input.trim();
		if (!message || !currentChatId || sendMessage.isPending) return;
		historyIndexRef.current = null;
		setInput("");
		await sendMessage.mutateAsync({ chatId: currentChatId, message });
	};

	const handleAction = (id: number, action: AlertAction) => {
		alertAction.mutate({ alertId: id, action });
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
				<div>
					<p className="text-xs font-bold uppercase tracking-widest text-primary">
						Assistant
					</p>
					<h1 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5 flex items-center gap-2">
						<Bot className="w-6 h-6 text-primary" />
						Copilote IA
					</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Votre assistant contextuel. Il connaît votre entreprise, votre
						mémoire et vos analyses passées.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<HealthBadge />
					<button
						type="button"
						onClick={() => refetch()}
						disabled={isFetching}
						className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
					>
						<RefreshCw
							className={cn("w-3.5 h-3.5", isFetching && "animate-spin")}
						/>
						Rafraîchir
					</button>
				</div>
			</header>

			{/* 3-column layout */}
			<div className="flex gap-4 h-[min(calc(100vh-14rem),720px)] min-h-[480px]">
				{/* ── Col gauche : historique ── */}
				{(!isMobile || isHistoryOpen) && (
					<>
						{isMobile && isHistoryOpen && (
							<div
								aria-hidden="true"
								className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
								onClick={() => setIsHistoryOpen(false)}
							/>
						)}
						{chatsLoading ? (
							<div className="w-64 shrink-0 flex items-center justify-center">
								<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
							</div>
						) : (
							<ChatHistorySidebar
								chats={chats}
								currentChatId={currentChatId}
								showArchived={showArchived}
								onToggleArchived={() => setShowArchived((p) => !p)}
								onNewChat={handleNewChat}
								onChatSelect={setCurrentChatId}
								onClose={() => setIsHistoryOpen(false)}
								isMobile={isMobile}
								createPending={createChat.isPending}
							/>
						)}
					</>
				)}

				{/* ── Col centrale : chat ── */}
				<section className="flex flex-col flex-1 min-w-0 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
					{/* Chat header */}
					<div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/20 shrink-0">
						{isMobile && (
							<button
								type="button"
								onClick={() => setIsHistoryOpen(true)}
								className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-accent"
							>
								<History className="w-4 h-4" />
							</button>
						)}

						{currentChatId && isEditingTitle ? (
							<div className="flex items-center gap-2 flex-1">
								<input
									value={newTitle}
									onChange={(e) => setNewTitle(e.target.value)}
									placeholder="Titre de la conversation"
									autoFocus
									className="flex-1 h-8 text-sm px-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											updateTitle.mutate({
												chatId: currentChatId,
												title: newTitle,
											});
											setIsEditingTitle(false);
										}
										if (e.key === "Escape") setIsEditingTitle(false);
									}}
								/>
								<button
									type="button"
									onClick={() => {
										updateTitle.mutate({
											chatId: currentChatId,
											title: newTitle,
										});
										setIsEditingTitle(false);
									}}
									disabled={!newTitle.trim()}
									className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
								>
									OK
								</button>
								<button
									type="button"
									onClick={() => setIsEditingTitle(false)}
									className="h-8 px-2 rounded-lg border border-border text-xs hover:bg-accent"
								>
									Annuler
								</button>
							</div>
						) : (
							<div className="flex items-center gap-2 flex-1 min-w-0 group">
								<h2 className="text-sm font-semibold truncate text-foreground">
									{currentChatId
										? (currentChat?.title ?? "Chat")
										: "Sélectionnez ou créez une conversation"}
								</h2>
								{currentChatId && (
									<button
										type="button"
										title="Renommer"
										onClick={() => {
											setNewTitle(currentChat?.title ?? "");
											setIsEditingTitle(true);
										}}
										className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-all"
									>
										<Edit2 className="w-3.5 h-3.5" />
									</button>
								)}
							</div>
						)}
					</div>

					{/* Messages */}
					<div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
						{!currentChatId && (
							<div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
								<div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
									<Sparkles className="w-7 h-7 text-primary" />
								</div>
								<p className="text-sm font-medium text-foreground">
									Posez votre question au copilote
								</p>
								<p className="text-xs text-muted-foreground max-w-xs">
									Ex. « Quelles actions prioritaires cette semaine ? », «
									Analyse ma situation de trésorerie ».
								</p>
								<button
									type="button"
									onClick={handleNewChat}
									disabled={createChat.isPending}
									className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 mt-2"
								>
									{createChat.isPending ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<Plus className="w-4 h-4" />
									)}
									Nouvelle conversation
								</button>
							</div>
						)}

						{currentChatId && messagesLoading && (
							<div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
								<Loader2 className="w-4 h-4 animate-spin" />
								Chargement…
							</div>
						)}

						{currentChatId && !messagesLoading && (
							<div className="flex justify-start">
								<div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mr-2 mt-0.5">
									<Bot className="w-4 h-4" />
								</div>
								<div className="max-w-[78%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed bg-accent text-foreground">
									<p>
										Bonjour ! Je suis votre Copilote IA. Comment puis-je vous
										aider aujourd'hui ?
									</p>
								</div>
							</div>
						)}

						{messages.map((m) => (
							<div
								key={m.id}
								className={cn(
									"flex",
									m.role === "user" ? "justify-end" : "justify-start",
								)}
							>
								{m.role === "assistant" && (
									<div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mr-2 mt-0.5">
										<Bot className="w-4 h-4" />
									</div>
								)}
								<div
									className={cn(
										"max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
										m.role === "user"
											? "bg-primary text-primary-foreground rounded-br-md"
											: "bg-accent text-foreground rounded-bl-md",
									)}
								>
									<p className="whitespace-pre-wrap">{m.message}</p>
									<span className="block mt-1 text-[10px] opacity-60">
										{m.createdDate &&
										!Number.isNaN(new Date(m.createdDate).getTime())
											? format(new Date(m.createdDate), "HH:mm", { locale: fr })
											: ""}
									</span>
								</div>
							</div>
						))}

						{sendMessage.isPending && (
							<div className="flex justify-start">
								<div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mr-2 mt-0.5">
									<Bot className="w-4 h-4" />
								</div>
								<div className="bg-accent text-foreground rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="w-4 h-4 animate-spin" />
									Le copilote réfléchit…
								</div>
							</div>
						)}

						<div ref={scrollRef} />
					</div>

					{/* Input */}
					<div className="border-t border-border/50 p-3 flex items-center gap-2 shrink-0">
						<textarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleSend();
									return;
								}
								if (e.key === "ArrowUp" || e.key === "ArrowDown") {
									const res = getHistoryMessage(
										e.key,
										historyIndexRef.current,
										userMessageTexts,
									);
									if (res) {
										setInput(res.text);
										historyIndexRef.current = res.nextIndex;
										e.preventDefault();
									}
								}
							}}
							rows={1}
							placeholder={
								currentChatId
									? "Écrivez votre message… (Entrée pour envoyer)"
									: "Sélectionnez une conversation pour commencer"
							}
							disabled={!currentChatId || sendMessage.isPending}
							className="flex-1 resize-none bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32 disabled:opacity-50"
						/>
						<button
							type="button"
							onClick={handleSend}
							disabled={
								!input.trim() || !currentChatId || sendMessage.isPending
							}
							className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
							title="Envoyer"
						>
							<Send className="w-4 h-4" />
						</button>
					</div>
				</section>

				{/* ── Col droite : insights / suggestions / priorités ── */}
				<aside className="w-[320px] shrink-0 hidden xl:flex flex-col gap-3 overflow-y-auto custom-scrollbar">
					{stateLoading ? (
						<div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
							<Loader2 className="w-4 h-4 animate-spin" />
							Chargement du contexte…
						</div>
					) : (
						<>
							<div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
								<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
									<AlertTriangle className="w-3.5 h-3.5" />
									Insights ({insights.length})
								</h3>
								{insights.length === 0 ? (
									<p className="text-xs text-muted-foreground py-1">
										Aucune alerte active.
									</p>
								) : (
									<ul className="space-y-2">
										{insights.map((ins) => (
											<InsightCard
												key={ins.id}
												insight={ins}
												onAction={handleAction}
												pending={alertAction.isPending}
											/>
										))}
									</ul>
								)}
							</div>

							<div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
								<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-1">
									<Sparkles className="w-3.5 h-3.5" />
									Suggestions ({suggestions.length})
								</h3>
								{suggestions.length === 0 ? (
									<p className="text-xs text-muted-foreground py-1">
										Lancez une analyse pour générer des suggestions.
									</p>
								) : (
									<ul className="divide-y divide-border/40">
										{suggestions.map((s) => (
											<SuggestionRow key={s.id} suggestion={s} />
										))}
									</ul>
								)}
							</div>

							{priorities.length > 0 && (
								<div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
									<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-1">
										<Target className="w-3.5 h-3.5" />
										Priorités ({priorities.length})
									</h3>
									<ul className="divide-y divide-border/40">
										{priorities.map((p) => (
											<SuggestionRow key={p.id} suggestion={p} />
										))}
									</ul>
								</div>
							)}
						</>
					)}
				</aside>
			</div>
		</div>
	);
}
