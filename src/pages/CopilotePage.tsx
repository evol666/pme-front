import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import {
  useAlertAction,
  useCopilotConverse,
  useCopilotHealth,
  useCopilotState,
  type AlertAction,
  type ConverseMessage,
  type CopilotInsight,
  type CopilotSuggestion,
} from "@/api/copilot";
import { cn } from "@/lib/utils";

// CopilotePage — assistant IA contextuel (page phare Phase 4).
// Conversation via POST /api/copilot/converse (l'historique est géré côté client
// et renvoyé à chaque tour). Le panneau latéral expose le "state" du copilote :
// insights (alertes), suggestions (recommandations) et priorités stratégiques.
// La santé du moteur Ollama est sondée toutes les 30s.

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
  model?: string;
  mock?: boolean;
  durationMs?: number;
  error?: boolean;
}

const SEVERITY_TONE: Record<string, string> = {
  high: "bg-red-500/10 text-red-600",
  medium: "bg-amber-500/10 text-amber-600",
  low: "bg-emerald-500/10 text-emerald-600",
};

function severityTone(sev: string): string {
  return SEVERITY_TONE[sev?.toLowerCase()] ?? "bg-accent text-muted-foreground";
}

function extractBackendError(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { error?: { message?: string } }; statusText?: string };
  };
  return (
    axiosErr?.response?.data?.error?.message ??
    axiosErr?.response?.statusText ??
    "Le copilote ne répond pas pour le moment."
  );
}

function HealthBadge() {
  const { data, isLoading } = useCopilotHealth();
  const reachable = data?.ollama_reachable ?? false;
  const mock = data?.mock ?? false;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider border",
        reachable && !mock
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          : mock
            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
            : "bg-red-500/10 text-red-600 border-red-500/20",
      )}
      title={data ? `Modèle: ${data.model}` : undefined}
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : reachable && !mock ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      {mock ? "Mode démo" : reachable ? "En ligne" : "Hors ligne"}
    </span>
  );
}

function InsightCard({
  insight,
  onAction,
  pending,
}: {
  insight: CopilotInsight;
  onAction: (id: number, action: AlertAction) => void;
  pending: boolean;
}) {
  return (
    <li className="bg-card border border-border/50 rounded-xl p-4 space-y-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
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
          <h4 className="mt-1.5 text-sm font-bold text-foreground truncate">
            {insight.title}
          </h4>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {insight.summary}
      </p>
      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => onAction(Number(insight.id), "act")}
          disabled={pending}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 disabled:opacity-50"
        >
          <CheckCircle2 className="w-3 h-3" />
          Agir
        </button>
        <button
          type="button"
          onClick={() => onAction(Number(insight.id), "dismiss")}
          disabled={pending}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Écarter
        </button>
      </div>
    </li>
  );
}

function SuggestionRow({ suggestion }: { suggestion: CopilotSuggestion }) {
  const label =
    suggestion.kind === "recommendation"
      ? "Reco"
      : suggestion.kind === "priority"
        ? "Priorité"
        : suggestion.kind;
  return (
    <li className="flex items-start gap-2.5 py-2.5">
      <CircleDot className="w-4 h-4 mt-0.5 text-primary shrink-0" />
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

export default function CopilotePage() {
  const { data: state, isLoading: stateLoading, refetch, isFetching } =
    useCopilotState({ maxSuggestions: 6, maxInsights: 5 });
  const converse = useCopilotConverse();
  const alertAction = useAlertAction();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const insights = useMemo(() => state?.insights ?? [], [state]);
  const suggestions = useMemo(() => state?.suggestions ?? [], [state]);
  const priorities = useMemo(() => state?.priorities ?? [], [state]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || converse.isPending) return;

    const history: ConverseMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    scrollToBottom();

    try {
      const reply = await converse.mutateAsync({
        message,
        history,
        temperature: 0.4,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply.text,
          model: reply.model,
          mock: reply.mock,
          durationMs: reply.duration_ms,
        },
      ]);
      scrollToBottom();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: extractBackendError(err), error: true },
      ]);
      scrollToBottom();
    }
  };

  const handleAction = (id: number, action: AlertAction) => {
    alertAction.mutate({ alertId: id, action });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Assistant
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1 flex items-center gap-3">
            <Bot className="w-7 h-7 text-primary" />
            Copilote IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
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
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            Rafraîchir
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* Chat */}
        <section className="flex flex-col bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden h-[600px]">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Posez votre question au copilote
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Ex. « Quelles actions prioritaires cette semaine ? », « Analyse
                  ma situation de trésorerie ».
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : m.error
                          ? "bg-red-500/10 text-red-600 border border-red-500/20 rounded-bl-md"
                          : "bg-accent text-foreground rounded-bl-md",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === "assistant" && !m.error && (
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{m.model ?? "modèle"}</span>
                        {m.mock && (
                          <span className="text-amber-600">
                            démo
                          </span>
                        )}
                        {m.durationMs != null && <span>· {m.durationMs} ms</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {converse.isPending && (
              <div className="flex justify-start">
                <div className="bg-accent text-foreground rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Le copilote réfléchit…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/50 p-3 flex items-center gap-2">
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
              className="flex-1 resize-none bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || converse.isPending}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Sidebar — insights / suggestions / priorités */}
        <aside className="space-y-4">
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
                  <p className="text-xs text-muted-foreground py-2">
                    Aucune alerte active.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
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
                  <p className="text-xs text-muted-foreground py-2">
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