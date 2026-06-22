import { useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  parsePersonaJsonObject,
  useCreatePersona,
  useDeletePersona,
  usePersonas,
  type CreateUserPersonaInput,
  type UserPersona,
} from "@/api/personas";
import { cn } from "@/lib/utils";

// Personas IA (LOT personnalités utilisateur). Version Spring Boot : liste le CRUD
// `/api/user-personas` avec filtre Criteria (role.contains), cartes personas (rôle,
// goals, preferences, dates), création via formulaire simple (role, goals,
// preferences → POST), suppression avec confirmation. Pas d'update (convention LOT).

function extractBackendError(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { error?: { message?: string } }; statusText?: string };
  };
  return (
    axiosErr?.response?.data?.error?.message ??
    axiosErr?.response?.statusText ??
    "Une erreur est survenue. Réessayez."
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

// Rendu lisible d'un @Lob : si JSON objet -> "key: value" par ligne, sinon texte brut.
function renderLob(raw: string | null | undefined): string {
  if (!raw) return "";
  const obj = parsePersonaJsonObject(raw);
  if (obj) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "";
    return entries
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
  }
  return raw;
}

export default function PersonasPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: personas, isLoading, refetch, isFetching } = usePersonas(
    appliedSearch || undefined,
  );
  const createMutation = useCreatePersona();
  const deleteMutation = useDeletePersona();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search.trim());
  };

  const handleCreated = (persona: UserPersona) => {
    setShowCreate(false);
    toast.success(`Persona « ${persona.role ?? "sans rôle"} » créée.`);
  };

  const handleDelete = async (persona: UserPersona) => {
    if (
      !window.confirm(
        `Supprimer la persona « ${persona.role ?? `#${persona.id}`} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteMutation.mutateAsync(persona.id);
      toast.success("Persona supprimée.");
    } catch (err) {
      const message = extractBackendError(err);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          Personas IA
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Personnalités utilisateur
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Définissez les rôles, objectifs et préférences qui calibrent l’IA selon
          le point de vue de chaque utilisateur. Une persona = un lens métier
          appliqué aux analyses et recommandations.
        </p>
      </header>

      {/* Barre d’actions */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-foreground">Recherche</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rôle de la persona…"
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Filtrer
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus className="h-4 w-4" />
            Nouvelle persona
          </button>
        </form>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {showCreate && (
        <CreatePersonaForm
          creating={createMutation.isPending}
          onCancel={() => setShowCreate(false)}
          onSubmit={async (input) => {
            setError(null);
            try {
              const created = await createMutation.mutateAsync(input);
              handleCreated(created);
            } catch (err) {
              const message = extractBackendError(err);
              setError(message);
              toast.error(message);
            }
          }}
        />
      )}

      {isLoading ? (
        <LoadingState />
      ) : !personas || personas.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onDelete={() => handleDelete(persona)}
              deleting={
                deleteMutation.isPending && deleteMutation.variables === persona.id
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaCard({
  persona,
  onDelete,
  deleting,
}: {
  persona: UserPersona;
  onDelete: () => void;
  deleting: boolean;
}) {
  const goalsText = useMemo(() => renderLob(persona.goals), [persona.goals]);
  const preferencesText = useMemo(
    () => renderLob(persona.preferences),
    [persona.preferences],
  );

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              {persona.role ?? "Sans rôle"}
            </span>
            <span className="text-xs text-muted-foreground">#{persona.id}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Supprimer
        </button>
      </header>

      {goalsText && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Objectifs
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground line-clamp-4">
            {goalsText}
          </p>
        </div>
      )}

      {preferencesText && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Préférences
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground line-clamp-4">
            {preferencesText}
          </p>
        </div>
      )}

      {!goalsText && !preferencesText && (
        <p className="text-sm text-muted-foreground italic">
          Aucun objectif ni préférence renseignés.
        </p>
      )}

      <dl className="mt-auto grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
        <div>
          <dt>Créée le</dt>
          <dd className="mt-0.5 text-foreground tabular-nums">
            {formatDateTime(persona.createdAt)}
          </dd>
        </div>
        <div>
          <dt>Mise à jour</dt>
          <dd className="mt-0.5 text-foreground tabular-nums">
            {formatDateTime(persona.updatedAt)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function CreatePersonaForm({
  creating,
  onCancel,
  onSubmit,
}: {
  creating: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateUserPersonaInput) => void;
}) {
  const [role, setRole] = useState("");
  const [goals, setGoals] = useState("");
  const [preferences, setPreferences] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedRole = role.trim();
    if (!trimmedRole) return;
    onSubmit({
      role: trimmedRole,
      goals: goals.trim() || null,
      preferences: preferences.trim() || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Nouvelle persona</h2>
      </div>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-foreground">
          Rôle <span className="text-destructive">*</span>
        </span>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          maxLength={64}
          required
          placeholder="ex. Directeur commercial, DAF, Ops…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-foreground">Objectifs</span>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={3}
          placeholder={'Texte libre ou JSON (ex. { "kpi": "MRR", "horizon": "Q+1" })'}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-foreground">Préférences</span>
        <textarea
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          rows={3}
          placeholder="Texte libre ou JSON (ton, vocabulaire, priorités…)"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={creating || !role.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Créer
        </button>
      </div>
    </form>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement des personas…
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">Aucune persona</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aucune persona ne correspond à votre recherche, ou aucune n’a encore été
        créée. Cliquez sur « Nouvelle persona » pour en ajouter une.
      </p>
    </div>
  );
}