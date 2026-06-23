import { useMemo, useState } from "react";
import {
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  billingKeys,
  extractBackendError,
  overviewField,
  useBillingInvoices,
  useBillingOverview,
  useBillingPricing,
  useCheckout,
  useDownloadInvoicePdf,
  useOpenPortal,
  type InvoiceView,
  type MetricUsage,
  type PlanDefinition,
  type PlanQuotas,
  type QuotaStatus,
  type SubscriptionView,
  type UpgradeSuggestion,
} from "@/api/billing";
import { cn } from "@/lib/utils";

// BillingPage — facturation & abonnement (LOT billing). Version Spring Boot.
// Source : BillingResource (/api/billing — overview, pricing, checkout, portal, invoices).
// États loading/empty/error sur chaque section. Boutons d'action désactivés pendant les
// mutations. Datetimes UTC affichées en fr-FR. Montants en centimes -> EUR.

// --- Helpers ---

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

function formatCurrency(cents: number | null | undefined, currency = "EUR"): string {
  if (cents == null) return "—";
  const value = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(p: number): string {
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)} %`;
}

// --- Statut abonnement ---

const SUB_TONE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600",
  trialing: "bg-sky-500/10 text-sky-600",
  past_due: "bg-amber-500/10 text-amber-600",
  unpaid: "bg-orange-500/10 text-orange-600",
  canceled: "bg-red-500/10 text-red-600",
  incomplete: "bg-slate-500/10 text-slate-600",
};

const SUB_LABEL: Record<string, string> = {
  active: "Actif",
  trialing: "Essai",
  past_due: "Paiement en retard",
  unpaid: "Impayé",
  canceled: "Résilié",
  incomplete: "Incomplet",
};

function subTone(status: string): string {
  return SUB_TONE[status?.toLowerCase()] ?? "bg-accent text-muted-foreground";
}

function subLabel(status: string): string {
  return SUB_LABEL[status?.toLowerCase()] ?? status ?? "—";
}

// --- Statut facture ---

const INV_TONE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600",
  open: "bg-sky-500/10 text-sky-600",
  draft: "bg-slate-500/10 text-slate-600",
  void: "bg-red-500/10 text-red-600",
  uncollectible: "bg-amber-500/10 text-amber-600",
};

const INV_LABEL: Record<string, string> = {
  paid: "Payée",
  open: "À payer",
  draft: "Brouillon",
  void: "Annulée",
  uncollectible: "Impayée",
};

function invTone(status: string): string {
  return INV_TONE[status?.toLowerCase()] ?? "bg-accent text-muted-foreground";
}

function invLabel(status: string): string {
  return INV_LABEL[status?.toLowerCase()] ?? status ?? "—";
}

// --- Statut quota ---

const QUOTA_TONE: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-600",
  warn: "bg-amber-500/10 text-amber-600",
  critical: "bg-orange-500/10 text-orange-600",
  exceeded: "bg-red-500/10 text-red-600",
  unlimited: "bg-sky-500/10 text-sky-600",
};

const QUOTA_LABEL: Record<string, string> = {
  ok: "OK",
  warn: "Attention",
  critical: "Critique",
  exceeded: "Dépassé",
  unlimited: "Illimité",
};

function quotaTone(status: string): string {
  return QUOTA_TONE[status] ?? "bg-accent text-muted-foreground";
}

function quotaLabel(status: string): string {
  return QUOTA_LABEL[status] ?? status ?? "—";
}

// --- Composants ---

export default function BillingPage() {
  const overviewQuery = useBillingOverview();
  const pricingQuery = useBillingPricing();
  const invoicesQuery = useBillingInvoices(10);

  const overview = overviewQuery.data;
  const subscription = overviewField<SubscriptionView | null>(
    overview,
    "subscription",
    "subscription",
  );
  const quotas = overviewField<QuotaStatus | null>(overview, "quotas", "quotas");
  const recentInvoices = overviewField<InvoiceView[] | null>(
    overview,
    "recent_invoices",
    "recentInvoices",
  );
  const upgrade = overviewField<UpgradeSuggestion | null>(
    overview,
    "upgrade_suggestion",
    "upgradeSuggestion",
  );
  const stripeMock = overviewField<boolean>(overview, "stripe_mock", "stripeMock") ?? false;

  const pricing = pricingQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        stripeMock={stripeMock}
        isFetching={overviewQuery.isFetching}
        onRefresh={() => {
          overviewQuery.refetch();
          pricingQuery.refetch();
          invoicesQuery.refetch();
        }}
      />

      {upgrade && <UpgradeBanner suggestion={upgrade} />}

      <SubscriptionSection
        subscription={subscription}
        isLoading={overviewQuery.isLoading}
        stripeMock={stripeMock}
      />

      <UsageSection quotas={quotas} isLoading={overviewQuery.isLoading} />

      <PricingSection
        plans={pricing}
        currentPlanName={subscription?.planName}
        isLoading={pricingQuery.isLoading}
        stripeMock={stripeMock}
      />

      <InvoicesSection
        invoices={invoicesQuery.data ?? recentInvoices ?? []}
        isLoading={invoicesQuery.isLoading && !recentInvoices}
      />
    </div>
  );
}

// --- Header ---

function PageHeader({
  stripeMock,
  isFetching,
  onRefresh,
}: {
  stripeMock: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="space-y-3">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
        <CreditCard className="h-4 w-4" />
        Facturation
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
        <Receipt className="h-7 w-7 text-primary" />
        Abonnement & factures
      </h1>
      <p className="max-w-2xl text-muted-foreground">
        Gérez votre plan, suivez votre consommation et accédez à vos factures.{" "}
        {stripeMock ? (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <Sparkles className="h-3.5 w-3.5" />
            Mode démo (mock Stripe)
          </span>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Rafraîchir
        </button>
      </div>
    </header>
  );
}

// --- Upgrade banner ---

function UpgradeBanner({ suggestion }: { suggestion: UpgradeSuggestion }) {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Suggestion de passage à « {suggestion.suggestedPlan} »
            </p>
            <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
            {suggestion.triggers.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
                {suggestion.triggers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Section abonnement ---

function SubscriptionSection({
  subscription,
  isLoading,
  stripeMock,
}: {
  subscription: SubscriptionView | null;
  isLoading: boolean;
  stripeMock: boolean;
}) {
  const checkout = useCheckout();
  const portal = useOpenPortal();
  const qc = useQueryClient();

  const handleCheckout = (planName: string, cycle: "monthly" | "annual") => {
    checkout.mutate(
      {
        planName,
        cycle,
        successUrl: `${window.location.origin}/billing?status=success`,
        cancelUrl: `${window.location.origin}/billing?status=cancel`,
      },
      {
        onSuccess: (result) => {
          if (result.url) {
            window.location.href = result.url;
          } else {
            toast.success("Session de checkout initiée.");
            qc.invalidateQueries({ queryKey: billingKeys.all });
          }
        },
        onError: (err) => toast.error(extractBackendError(err)),
      },
    );
  };

  const handlePortal = () => {
    portal.mutate(`${window.location.origin}/billing`, {
      onSuccess: (result) => {
        if (result.url) {
          window.location.href = result.url;
        } else {
          toast.error("Impossible d'ouvrir le portail client.");
        }
      },
      onError: (err) => toast.error(extractBackendError(err)),
    });
  };

  if (isLoading) {
    return (
      <SectionCard>
        <SectionSkeleton title="Abonnement courant" />
      </SectionCard>
    );
  }

  if (!subscription) {
    return (
      <SectionCard>
        <SectionTitle icon={CreditCard} title="Abonnement courant" />
        <EmptyMessage message="Aucun abonnement actif. Choisissez un plan ci-dessous pour démarrer." />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <SectionTitle icon={CreditCard} title="Abonnement courant" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile label="Plan" value={subscription.planLabel} />
        <InfoTile
          label="Statut"
          value={
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                subTone(subscription.status),
              )}
            >
              {subLabel(subscription.status)}
            </span>
          }
        />
        <InfoTile
          label="Cycle"
          value={subscription.billingCycle === "annual" ? "Annuel" : "Mensuel"}
        />
        <InfoTile
          label="Montant"
          value={formatCurrency(subscription.amountCents, subscription.currency)}
        />
        <InfoTile
          label="Fin de période"
          value={formatDate(subscription.currentPeriodEnd)}
        />
        <InfoTile label="Fin d'essai" value={formatDate(subscription.trialEnd)} />
        <InfoTile
          label="Résiliation fin de période"
          value={subscription.cancelAtPeriodEnd ? "Oui" : "Non"}
        />
        <InfoTile label="Résilié le" value={formatDate(subscription.canceledAt)} />
      </div>

      {subscription.inGracePeriod && (
        <Banner
          tone="amber"
          message="Paiement en retard. Mettez à jour votre moyen de paiement via le portail client."
        />
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => handleCheckout(subscription.planName, "monthly")}
          disabled={checkout.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {checkout.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Changer de plan
        </button>
        <button
          type="button"
          onClick={handlePortal}
          disabled={portal.isPending || stripeMock}
          title={
            stripeMock
              ? "Portail client indisponible en mode démo"
              : "Gérer moyens de paiement & factures Stripe"
          }
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {portal.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          Portail client
        </button>
      </div>
    </SectionCard>
  );
}

// --- Section usage / quotas ---

function UsageSection({
  quotas,
  isLoading,
}: {
  quotas: QuotaStatus | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <SectionCard>
        <SectionSkeleton title="Consommation du mois" />
      </SectionCard>
    );
  }
  if (!quotas) {
    return (
      <SectionCard>
        <SectionTitle icon={TrendingUp} title="Consommation du mois" />
        <EmptyMessage message="Aucune donnée de consommation disponible pour le moment." />
      </SectionCard>
    );
  }

  const overallTone = quotaTone(quotas.overallStatus);

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={TrendingUp} title="Consommation du mois" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Depuis {formatDate(quotas.periodStart)}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
              overallTone,
            )}
          >
            {quotaLabel(quotas.overallStatus)}
          </span>
        </div>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {quotas.metrics.map((m) => (
          <MetricRow key={m.metric} metric={m} />
        ))}
      </ul>
    </SectionCard>
  );
}

function MetricRow({ metric }: { metric: MetricUsage }) {
  const unlimited = metric.limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round(metric.percent * 100));
  const barTone = unlimited
    ? "bg-sky-500"
    : metric.status === "exceeded" || metric.status === "critical"
      ? "bg-red-500"
      : metric.status === "warn"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{metric.label}</span>
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            quotaTone(metric.status),
          )}
        >
          {quotaLabel(metric.status)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
        <span>
          {metric.used.toLocaleString("fr-FR")}
          {unlimited ? " · illimité" : ` / ${metric.limit?.toLocaleString("fr-FR")}`}
        </span>
        <span>{unlimited ? "—" : formatPercent(metric.percent)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barTone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

// --- Section pricing ---

function PricingSection({
  plans,
  currentPlanName,
  isLoading,
  stripeMock,
}: {
  plans: PlanDefinition[];
  currentPlanName?: string;
  isLoading: boolean;
  stripeMock: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const checkout = useCheckout();
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <SectionCard>
        <SectionSkeleton title="Tarifs" />
      </SectionCard>
    );
  }
  if (plans.length === 0) {
    return (
      <SectionCard>
        <SectionTitle icon={Sparkles} title="Tarifs" />
        <EmptyMessage message="Aucun plan tarifaire configuré." />
      </SectionCard>
    );
  }

  const handleSelect = (plan: PlanDefinition) => {
    if (plan.name === currentPlanName?.toLowerCase()) {
      toast.message("Plan courant déjà actif.");
      return;
    }
    checkout.mutate(
      {
        planName: plan.name,
        cycle,
        successUrl: `${window.location.origin}/billing?status=success`,
        cancelUrl: `${window.location.origin}/billing?status=cancel`,
      },
      {
        onSuccess: (result) => {
          if (result.url) {
            window.location.href = result.url;
          } else {
            toast.success("Session de checkout initiée.");
            qc.invalidateQueries({ queryKey: billingKeys.all });
          }
        },
        onError: (err) => toast.error(extractBackendError(err)),
      },
    );
  };

  return (
    <SectionCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle icon={Sparkles} title="Tarifs" />
        <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
          <CycleToggle
            label="Mensuel"
            active={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
          />
          <CycleToggle
            label="Annuel"
            active={cycle === "annual"}
            onClick={() => setCycle("annual")}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            cycle={cycle}
            current={plan.name === currentPlanName?.toLowerCase()}
            stripeMock={stripeMock}
            pending={checkout.isPending}
            onSelect={() => handleSelect(plan)}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function CycleToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function PlanCard({
  plan,
  cycle,
  current,
  stripeMock,
  pending,
  onSelect,
}: {
  plan: PlanDefinition;
  cycle: "monthly" | "annual";
  current: boolean;
  stripeMock: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  const price = cycle === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
  const perMonth = cycle === "annual" ? plan.annualPriceCents / 12 : plan.monthlyPriceCents;
  const quotas: PlanQuotas = plan.quotas;
  const quotaEntries = useMemo(
    () =>
      [
        { label: "Tokens IA", value: quotas.aiTokens },
        { label: "Requêtes IA", value: quotas.aiRequests },
        { label: "Modules", value: quotas.modulesExecutions },
        { label: "Exports", value: quotas.exports },
        { label: "Embeddings", value: quotas.embeddings },
        { label: "Tours copilote", value: quotas.copilotTurns },
      ].filter((e) => e.value != null),
    [quotas],
  );

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
        plan.highlight ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          <Sparkles className="h-3 w-3" />
          Populaire
        </span>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">{plan.label}</h3>
        {current && (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            Actuel
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {formatCurrency(price, plan.currency)}
        </span>
        <span className="text-xs text-muted-foreground">
          {cycle === "annual" ? "/ an" : "/ mois"}
        </span>
      </div>
      {cycle === "annual" && (
        <p className="text-xs text-muted-foreground">
          ≈ {formatCurrency(Math.round(perMonth), plan.currency)} / mois
        </p>
      )}

      {quotaEntries.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {quotaEntries.map((e) => (
            <div key={e.label} className="rounded-md bg-muted/50 px-2 py-1">
              <dt className="text-muted-foreground">{e.label}</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {(e.value as number).toLocaleString("fr-FR")}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        {plan.features.slice(0, 6).map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span className="line-clamp-1">{f}</span>
          </li>
        ))}
        {plan.features.length > 6 && (
          <li className="text-muted-foreground/70">
            + {plan.features.length - 6} autres
          </li>
        )}
      </ul>

      <div className="mt-5 flex-1" />
      <button
        type="button"
        onClick={onSelect}
        disabled={current || pending}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
          current
            ? "border border-border bg-background text-muted-foreground"
            : plan.highlight
              ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              : "border border-border bg-background text-foreground hover:bg-accent",
        )}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {current
          ? "Plan actuel"
          : plan.trialDays > 0 && !stripeMock
            ? `Essai ${plan.trialDays} j`
            : "Choisir"}
      </button>
    </div>
  );
}

// --- Section factures ---

function InvoicesSection({
  invoices,
  isLoading,
}: {
  invoices: InvoiceView[];
  isLoading: boolean;
}) {
  const download = useDownloadInvoicePdf();

  const handleDownload = (inv: InvoiceView) => {
    download.mutate(
      { id: inv.id, number: inv.number },
      { onError: (err) => toast.error(extractBackendError(err)) },
    );
  };

  return (
    <SectionCard>
      <SectionTitle icon={Receipt} title="Factures récentes" />
      {isLoading ? (
        <SectionSkeleton title="" compact />
      ) : invoices.length === 0 ? (
        <EmptyMessage message="Aucune facture émise pour le moment." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Montant dû</th>
                <th className="px-4 py-3 text-right">Payé</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">Émise le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 font-medium text-foreground">{inv.number}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                        invTone(inv.status),
                      )}
                    >
                      {invLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(inv.amountDueCents, inv.currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(inv.amountPaidCents, inv.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(inv.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {inv.hostedInvoiceUrl && (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                          title="Voir sur Stripe"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownload(inv)}
                        disabled={download.isPending}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
                        title="Télécharger le PDF"
                      >
                        {download.isPending && download.variables?.id === inv.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {invoices.length > 0 && (
        <p className="pt-2 text-xs text-muted-foreground">
          {invoices.length} facture{invoices.length > 1 ? "s" : ""} récente
          {invoices.length > 1 ? "s" : ""}.
        </p>
      )}
    </SectionCard>
  );
}

// --- UI primitives ---

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      {children}
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </h2>
  );
}

function SectionSkeleton({ title, compact }: { title: string; compact?: boolean }) {
  return (
    <div className="space-y-3">
      {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground",
          compact ? "p-6" : "p-10",
        )}
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement…
      </div>
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Banner({
  tone,
  message,
}: {
  tone: "amber" | "red" | "sky";
  message: string;
}) {
  const tones: Record<string, string> = {
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-700",
    red: "border-red-500/40 bg-red-500/10 text-red-700",
    sky: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  };
  return <p className={cn("rounded-lg border px-3 py-2 text-sm", tones[tone])}>{message}</p>;
}