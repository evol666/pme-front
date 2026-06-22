import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Clock,
  Filter,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  Slack,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";

import {
  parsePreferenceJsonObject,
  serializePreferenceJson,
  useNotificationPreferences,
  usePatchNotificationPreference,
  usePatchUserPreference,
  useUserPreferences,
  type DigestFrequency,
  type MinPriority,
  type NotificationPreference,
  type NotificationPreferencePatch,
  type UserPreference,
} from "@/api/preferences";
import { cn } from "@/lib/utils";

// /preferences-ia — Préférences utilisateur IA. Version Spring Boot.
//
// 2 onglets :
//   Style de rédaction — 3 axes (ton / longueur / niveau_detail) mappés sur
//     UserPreference (preferredTone / uiDensity / extras JSON). Édition via PATCH.
//   Notifications — NotificationPreference (canaux, URLs, digest, quiet hours,
//     priorité min, filtre catégories). Édition via bouton Enregistrer (PATCH).
//
// L'ancienne page v2 était 100% locale (Zustand persisté localStorage). La version
// Spring Boot persiste côté backend via /api/user-preferences et
// /api/notification-preferences. Si aucune préférence n'existe encore (état vide),
// la page affiche un message d'aide — la création initiale se fait via un autre
// flux (onboarding/admin) car le POST nécessite user+tenant non-null.

type TabKey = "style" | "notifications";

const TABS: { key: TabKey; label: string; icon: typeof Settings2 }[] = [
  { key: "style", label: "Style de rédaction", icon: Settings2 },
  { key: "notifications", label: "Notifications", icon: Bell },
];

// --- Style IA : choix ---

type TonIA = "professionnel" | "chaleureux" | "direct" | "formel";
type LongueurIA = "concise" | "standard" | "detaillee";
type NiveauDetailIA = "essentiel" | "equilibre" | "approfondi";

interface Choice<T extends string> {
  value: T;
  label: string;
  hint: string;
}

const TON_CHOICES: Choice<TonIA>[] = [
  { value: "professionnel", label: "Professionnel", hint: "Neutre, registre conseil" },
  { value: "chaleureux", label: "Chaleureux", hint: "Accessible, proche" },
  { value: "direct", label: "Direct", hint: "Factuel, droit au but" },
  { value: "formel", label: "Formel", hint: "Institutionnel, soutenu" },
];

const LONGUEUR_CHOICES: Choice<LongueurIA>[] = [
  { value: "concise", label: "Concise", hint: "À l'essentiel" },
  { value: "standard", label: "Standard", hint: "Équilibrée" },
  { value: "detaillee", label: "Détaillée", hint: "Développée" },
];

const DETAIL_CHOICES: Choice<NiveauDetailIA>[] = [
  { value: "essentiel", label: "Essentiel", hint: "Points clés" },
  { value: "equilibre", label: "Équilibré", hint: "Clés + justifications" },
  { value: "approfondi", label: "Approfondi", hint: "Nuances et cas" },
];

const DEFAULT_TON: TonIA = "professionnel";
const DEFAULT_LONGUEUR: LongueurIA = "standard";
const DEFAULT_DETAIL: NiveauDetailIA = "equilibre";

const DIGEST_FREQUENCIES: { value: DigestFrequency; label: string }[] = [
  { value: "NONE", label: "Aucun" },
  { value: "DAILY", label: "Quotidien" },
  { value: "WEEKLY", label: "Hebdomadaire" },
  { value: "MONTHLY", label: "Mensuel" },
];

const MIN_PRIORITIES: { value: MinPriority; label: string }[] = [
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyenne" },
  { value: "HIGH", label: "Élevée" },
  { value: "CRITICAL", label: "Critique" },
];

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

export default function PreferencesIAPage() {
  const [tab, setTab] = useState<TabKey>("style");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Settings2 className="h-4 w-4" />
          Préférences IA
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Style de rédaction & notifications
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Ajustez le ton, la longueur et le niveau de détail des livrables générés, et
          configurez les canaux de notification. Enregistrés côté serveur et appliqués à
          chaque génération.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "style" && <StyleTab />}
      {tab === "notifications" && <NotificationsTab />}
    </div>
  );
}

// --- Onglet Style de rédaction ---

function StyleTab() {
  const { data, isLoading, isFetching, refetch } = useUserPreferences();
  const patchMutation = usePatchUserPreference();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // La première préférence de l'utilisateur courant (relation 1:1 AppUser).
  const pref: UserPreference | null = data && data.length > 0 ? data[0] : null;

  // Valeurs dérivées du DTO (preferredTone / uiDensity / extras JSON).
  const ton = (pref?.preferredTone as TonIA | null) ?? DEFAULT_TON;
  const longueur = (pref?.uiDensity as LongueurIA | null) ?? DEFAULT_LONGUEUR;
  const extras = parsePreferenceJsonObject(pref?.extras);
  const niveauDetail =
    (extras?.niveau_detail as NiveauDetailIA | null) ?? DEFAULT_DETAIL;

  const isDefault =
    ton === DEFAULT_TON &&
    longueur === DEFAULT_LONGUEUR &&
    niveauDetail === DEFAULT_DETAIL;

  const persist = async (patch: {
    preferredTone?: string;
    uiDensity?: string;
    extras?: string | null;
  }) => {
    if (!pref) return;
    setError(null);
    try {
      await patchMutation.mutateAsync({ id: pref.id, ...patch });
      setSavedAt(new Date().toISOString());
      toast.success("Préférence enregistrée.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const onChangeTon = (v: TonIA) => persist({ preferredTone: v });
  const onChangeLongueur = (v: LongueurIA) => persist({ uiDensity: v });
  const onChangeNiveauDetail = (v: NiveauDetailIA) => {
    const nextExtras = serializePreferenceJson({
      ...(extras ?? {}),
      niveau_detail: v,
    });
    persist({ extras: nextExtras });
  };

  const onReset = () => {
    persist({
      preferredTone: DEFAULT_TON,
      uiDensity: DEFAULT_LONGUEUR,
      extras: serializePreferenceJson({ niveau_detail: DEFAULT_DETAIL }),
    });
  };

  if (isLoading) return <LoadingState label="Chargement des préférences de style…" />;

  if (!pref) {
    return (
      <EmptyState
        icon={Settings2}
        title="Aucune préférence de style"
        hint="Aucune préférence utilisateur enregistrée pour le moment. Elle sera créée lors de votre première interaction IA ou via l'onboarding."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Dernière mise à jour :{" "}
          <span className="tabular-nums text-foreground">
            {formatDateTime(savedAt ?? pref.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <button
              type="button"
              onClick={onReset}
              disabled={patchMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Réinitialiser
            </button>
          )}
          <RefetchButton isFetching={isFetching} onClick={() => refetch()} />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-7">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Style de rédaction</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Appliqué à chaque génération de livrable. L'IA n'invente jamais de données :
            les informations manquantes restent marquées « À compléter ».
          </p>
        </div>

        <SegmentedField
          title="Ton"
          description="Le registre de langage employé."
          choices={TON_CHOICES}
          value={ton}
          onChange={onChangeTon}
          busy={patchMutation.isPending}
        />
        <SegmentedField
          title="Longueur"
          description="La densité globale du livrable."
          choices={LONGUEUR_CHOICES}
          value={longueur}
          onChange={onChangeLongueur}
          busy={patchMutation.isPending}
        />
        <SegmentedField
          title="Niveau de détail"
          description="La profondeur des explications."
          choices={DETAIL_CHOICES}
          value={niveauDetail}
          onChange={onChangeNiveauDetail}
          busy={patchMutation.isPending}
        />
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Vos préférences sont prises en compte dès la prochaine génération.
      </p>
    </div>
  );
}

function SegmentedField<T extends string>({
  title,
  description,
  choices,
  value,
  onChange,
  busy,
}: {
  title: string;
  description: string;
  choices: Choice<T>[];
  value: T;
  onChange: (v: T) => void;
  busy: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {choices.map((c) => {
          const active = c.value === value;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => onChange(c.value)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-accent",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-foreground">{c.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
              <span className="text-[11px] text-muted-foreground">{c.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Onglet Notifications ---

function NotificationsTab() {
  const { data, isLoading, isFetching, refetch } = useNotificationPreferences();
  const patchMutation = usePatchNotificationPreference();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const pref: NotificationPreference | null =
    data && data.length > 0 ? data[0] : null;

  // État local pour édition groupée (PATCH au submit, pas au toggle individuel).
  const [draft, setDraft] = useState<NotificationPreference | null>(pref);

  // Re-sync quand les données serveur changent (refetch, mutation success).
  useEffect(() => {
    setDraft(pref);
  }, [pref]);

  const categories = useMemo(
    () => parsePreferenceJsonObject(draft?.categoriesFilter),
    [draft?.categoriesFilter],
  );
  const [categoriesText, setCategoriesText] = useState<string>(
    pref?.categoriesFilter ?? "",
  );

  useEffect(() => {
    setCategoriesText(pref?.categoriesFilter ?? "");
  }, [pref?.categoriesFilter]);

  if (isLoading) {
    return <LoadingState label="Chargement des préférences de notification…" />;
  }

  if (!pref) {
    return (
      <EmptyState
        icon={Bell}
        title="Aucune préférence de notification"
        hint="Aucune préférence de notification enregistrée pour le moment. Elle sera créée lors de votre première interaction IA ou via l'onboarding."
      />
    );
  }

  const toggle = (key: keyof NotificationPreferencePatch, value: boolean) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const setField = (key: keyof NotificationPreferencePatch, value: unknown) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const handleSave = async () => {
    if (!draft) return;
    setError(null);
    const patch: Record<string, unknown> = { id: draft.id };
    const fields: (keyof NotificationPreferencePatch)[] = [
      "inAppEnabled",
      "emailEnabled",
      "webhookEnabled",
      "slackEnabled",
      "teamsEnabled",
      "webhookUrl",
      "slackWebhookUrl",
      "teamsWebhookUrl",
      "emailTo",
      "digestFrequency",
      "digestHourUtc",
      "quietHoursStart",
      "quietHoursEnd",
      "minPriority",
    ];
    for (const f of fields) {
      patch[f] = draft[f];
    }
    // categoriesFilter : on envoie le texte tel quel (JSON string @Lob). Si vide → null.
    patch.categoriesFilter = categoriesText.trim() === "" ? null : categoriesText;

    try {
      await patchMutation.mutateAsync(patch as NotificationPreferencePatch);
      setSavedAt(new Date().toISOString());
      toast.success("Notifications enregistrées.");
    } catch (err) {
      const msg = extractBackendError(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const isDirty = useMemo(() => {
    if (!draft || !pref) return false;
    const cmp: Array<keyof NotificationPreference> = [
      "inAppEnabled",
      "emailEnabled",
      "webhookEnabled",
      "slackEnabled",
      "teamsEnabled",
      "webhookUrl",
      "slackWebhookUrl",
      "teamsWebhookUrl",
      "emailTo",
      "digestFrequency",
      "digestHourUtc",
      "quietHoursStart",
      "quietHoursEnd",
      "minPriority",
    ];
    for (const k of cmp) {
      if (draft[k] !== pref[k]) return true;
    }
    if ((categoriesText ?? "") !== (pref.categoriesFilter ?? "")) return true;
    return false;
  }, [draft, pref, categoriesText]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Dernière mise à jour :{" "}
          <span className="tabular-nums text-foreground">
            {formatDateTime(savedAt ?? pref.updatedAt)}
          </span>
        </div>
        <RefetchButton isFetching={isFetching} onClick={() => refetch()} />
      </div>

      {error && <ErrorBanner message={error} />}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Canaux de notification</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToggleRow
            icon={Bell}
            label="In-app"
            description="Notifications dans l'application"
            checked={draft?.inAppEnabled ?? false}
            onChange={(v) => toggle("inAppEnabled", v)}
          />
          <ToggleRow
            icon={Mail}
            label="E-mail"
            description="Envoi par e-mail"
            checked={draft?.emailEnabled ?? false}
            onChange={(v) => toggle("emailEnabled", v)}
          />
          <ToggleRow
            icon={Webhook}
            label="Webhook"
            description="Appel HTTP générique"
            checked={draft?.webhookEnabled ?? false}
            onChange={(v) => toggle("webhookEnabled", v)}
          />
          <ToggleRow
            icon={Slack}
            label="Slack"
            description="Slack incoming webhook"
            checked={draft?.slackEnabled ?? false}
            onChange={(v) => toggle("slackEnabled", v)}
          />
          <ToggleRow
            icon={MessageSquare}
            label="Microsoft Teams"
            description="Teams connector webhook"
            checked={draft?.teamsEnabled ?? false}
            onChange={(v) => toggle("teamsEnabled", v)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="URL Webhook"
            value={draft?.webhookUrl ?? ""}
            onChange={(v) => setField("webhookUrl", v || null)}
            placeholder="https://hooks.example.com/…"
          />
          <TextField
            label="URL Slack"
            value={draft?.slackWebhookUrl ?? ""}
            onChange={(v) => setField("slackWebhookUrl", v || null)}
            placeholder="https://hooks.slack.com/services/…"
          />
          <TextField
            label="URL Teams"
            value={draft?.teamsWebhookUrl ?? ""}
            onChange={(v) => setField("teamsWebhookUrl", v || null)}
            placeholder="https://outlook.office.com/webhook/…"
          />
          <TextField
            label="Destinataire e-mail"
            value={draft?.emailTo ?? ""}
            onChange={(v) => setField("emailTo", v || null)}
            placeholder="alertes@exemple.fr"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Digest & horaires</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Fréquence digest</span>
            <select
              value={draft?.digestFrequency ?? "NONE"}
              onChange={(e) => setField("digestFrequency", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DIGEST_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <NumberField
            label="Heure digest (UTC, 0-23)"
            value={draft?.digestHourUtc ?? 0}
            min={0}
            max={23}
            onChange={(v) => setField("digestHourUtc", v)}
          />
          <NumberField
            label="Heures silencieuses — début (0-23)"
            value={draft?.quietHoursStart ?? 0}
            min={0}
            max={23}
            onChange={(v) => setField("quietHoursStart", v)}
          />
          <NumberField
            label="Heures silencieuses — fin (0-23)"
            value={draft?.quietHoursEnd ?? 0}
            min={0}
            max={23}
            onChange={(v) => setField("quietHoursEnd", v)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Filtre & priorité</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Priorité minimale</span>
            <select
              value={draft?.minPriority ?? "MEDIUM"}
              onChange={(e) => setField("minPriority", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MIN_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">
              Filtre catégories (JSON)
            </span>
            <textarea
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              rows={3}
              placeholder='{"include": ["risk", "opportunity"], "exclude": []}'
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {categories && (
              <p className="text-xs text-muted-foreground">
                {Object.keys(categories).length} clé(s) détectée(s) — JSON valide.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || patchMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
            isDirty
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border bg-background text-muted-foreground",
          )}
        >
          {patchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// --- Composants UI partagés ---

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof Bell;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <span
        className={cn(
          "relative ml-2 mt-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background shadow transition",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function RefetchButton({ isFetching, onClick }: { isFetching: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      Actualiser
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Settings2;
  title: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}