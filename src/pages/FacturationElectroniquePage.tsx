import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  extractBackendError,
  facturationKeys,
  parseInvoiceLineItems,
  useCreateInvoice,
  useDeleteInvoice,
  useInvoices,
  usePatchInvoice,
  useSubscriptions,
  type InvoiceDTO,
  type InvoiceLineItem,
  type SubscriptionDTO,
} from "@/api/facturation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// FacturationElectroniquePage — suivi des factures électroniques (LOT e-invoicing).
// Version Spring Boot. Source : InvoiceResource (/api/invoices) +
// SubscriptionResource (/api/subscriptions).
//
// Liste des factures avec filtre statut, tri par createdAt desc (côté client car
// le endpoint retourne une List non paginée), détail expansible (lineItems @Lob
// parsé), création via formulaire modal, section secondaire abonnements.
// États loading/empty/error sur chaque section. Datetimes UTC affichées en
// fr-FR. Montants en centimes -> devise fr-FR.

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

function formatCurrency(
  cents: number | null | undefined,
  currency = "EUR",
): string {
  if (cents == null) return "—";
  const value = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

// --- Statuts facture ---

const INV_TONE: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  OVERDUE: "bg-red-500/10 text-red-600 dark:text-red-400",
  CANCELLED: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  DRAFT: "bg-muted text-muted-foreground",
  OPEN: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  VOID: "bg-red-500/10 text-red-600 dark:text-red-400",
  UNCOLLECTIBLE: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

const INV_LABEL: Record<string, string> = {
  PAID: "Payée",
  PENDING: "En attente",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
  DRAFT: "Brouillon",
  OPEN: "À payer",
  VOID: "Nulle",
  UNCOLLECTIBLE: "Impayée",
};

function invTone(status: string): string {
  return INV_TONE[status] ?? "bg-muted text-muted-foreground";
}

function invLabel(status: string): string {
  return INV_LABEL[status] ?? status ?? "—";
}

// --- Statuts abonnement ---

const SUB_TONE: Record<string, string> = {
  TRIALING: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PAST_DUE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  UNPAID: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  CANCELED: "bg-red-500/10 text-red-600 dark:text-red-400",
  INCOMPLETE: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const SUB_LABEL: Record<string, string> = {
  TRIALING: "Essai",
  ACTIVE: "Actif",
  PAST_DUE: "Paiement en retard",
  UNPAID: "Impayé",
  CANCELED: "Résilié",
  INCOMPLETE: "Incomplet",
};

function subTone(status: string): string {
  return SUB_TONE[status] ?? "bg-muted text-muted-foreground";
}

function subLabel(status: string): string {
  return SUB_LABEL[status] ?? status ?? "—";
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "PAID", label: "Payées" },
  { value: "PENDING", label: "En attente" },
  { value: "OVERDUE", label: "En retard" },
  { value: "CANCELLED", label: "Annulées" },
];

// --- Page ---

export default function FacturationElectroniquePage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const invoicesQuery = useInvoices(statusFilter ? { status: statusFilter } : {});
  const subscriptionsQuery = useSubscriptions();

  const invoices = invoicesQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        isFetching={invoicesQuery.isFetching}
        onRefresh={() => {
          invoicesQuery.refetch();
          subscriptionsQuery.refetch();
        }}
        onCreate={() => setShowCreate(true)}
      />

      {invoicesQuery.isError ? (
        <ErrorBanner
          message={extractBackendError(invoicesQuery.error)}
          onRetry={() => invoicesQuery.refetch()}
        />
      ) : null}

      <InvoicesSection
        invoices={invoices}
        isLoading={invoicesQuery.isLoading}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <SubscriptionsSection
        subscriptions={subscriptions}
        isLoading={subscriptionsQuery.isLoading}
      />

      {showCreate ? (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      ) : null}
    </div>
  );
}

// --- Header ---

function PageHeader({
  isFetching,
  onRefresh,
  onCreate,
}: {
  isFetching: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <header className="space-y-3">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
        <FileText className="h-4 w-4" />
        Facturation électronique
      </p>
      <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
        <Receipt className="h-7 w-7 text-primary" />
        Factures & abonnements
      </h1>
      <p className="max-w-2xl text-muted-foreground">
        Suivez vos factures électroniques et vos abonnements. Les montants sont
        exprimés en euros.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Rafraîchir
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </button>
      </div>
    </header>
  );
}

// --- Section factures ---

function InvoicesSection({
  invoices,
  isLoading,
  statusFilter,
  onStatusFilterChange,
}: {
  invoices: InvoiceDTO[];
  isLoading: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Receipt className="h-5 w-5 text-primary" />
          Factures
        </h2>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onStatusFilterChange(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : invoices.length === 0 ? (
        <EmptyBlock message="Aucune facture pour ce filtre." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3" aria-label="Détail" />
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Émise le</th>
                <th className="px-4 py-3">Échéance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id ?? inv.number} invoice={inv} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoices.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {invoices.length} facture{invoices.length > 1 ? "s" : ""}.
        </p>
      ) : null}
    </section>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceDTO }) {
  const [expanded, setExpanded] = useState(false);
  const patch = usePatchInvoice();
  const del = useDeleteInvoice();
  const qc = useQueryClient();

  const lineItems = useMemo(
    () => parseInvoiceLineItems(invoice.lineItems),
    [invoice.lineItems],
  );

  const handleMarkPaid = () => {
    if (invoice.id == null) return;
    patch.mutate(
      {
        id: invoice.id,
        patch: {
          status: "PAID",
          paidAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => toast.success("Facture marquée comme payée."),
        onError: (err) => toast.error(extractBackendError(err)),
      },
    );
  };

  const handleDelete = () => {
    if (invoice.id == null) return;
    del.mutate(invoice.id, {
      onSuccess: () => {
        toast.success("Facture supprimée.");
        qc.invalidateQueries({ queryKey: facturationKeys.all });
      },
      onError: (err) => toast.error(extractBackendError(err)),
    });
  };

  return (
    <>
      <tr className="hover:bg-accent/40">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={expanded ? "Réduire" : "Développer"}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3 font-medium text-foreground">{invoice.number}</td>
        <td className="px-4 py-3 text-muted-foreground">
          {invoice.tenant?.name ?? "—"}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-foreground">
          {formatCurrency(invoice.amountDueCents, invoice.currency)}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
              invTone(invoice.status),
            )}
          >
            {invLabel(invoice.status)}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {formatDateTime(invoice.createdAt)}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {formatDate(invoice.dueDate)}
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-muted/30">
          <td colSpan={7} className="px-4 py-4">
            <InvoiceDetail
              invoice={invoice}
              lineItems={lineItems}
              onMarkPaid={handleMarkPaid}
              onDelete={handleDelete}
              markingPaid={patch.isPending}
              deleting={del.isPending}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function InvoiceDetail({
  invoice,
  lineItems,
  onMarkPaid,
  onDelete,
  markingPaid,
  deleting,
}: {
  invoice: InvoiceDTO;
  lineItems: InvoiceLineItem[];
  onMarkPaid: () => void;
  onDelete: () => void;
  markingPaid: boolean;
  deleting: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-2 lg:col-span-2">
        <h3 className="text-sm font-semibold text-foreground">
          Lignes de facture
        </h3>
        {lineItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune ligne détaillée (champ lineItems vide ou non JSON).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Qté</th>
                  <th className="px-3 py-2 text-right">Prix unit.</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-foreground">
                      {item.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {item.quantity ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(item.unitAmountCents, invoice.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {formatCurrency(item.amountCents, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <dl className="space-y-2 rounded-lg border border-border bg-background p-3 text-xs">
        <DetailRow
          label="Montant dû"
          value={formatCurrency(invoice.amountDueCents, invoice.currency)}
        />
        <DetailRow
          label="Montant payé"
          value={formatCurrency(invoice.amountPaidCents, invoice.currency)}
        />
        <DetailRow
          label="TVA"
          value={formatCurrency(invoice.taxCents, invoice.currency)}
        />
        <DetailRow
          label="Période"
          value={`${formatDate(invoice.periodStart)} → ${formatDate(invoice.periodEnd)}`}
        />
        <DetailRow label="Payée le" value={formatDate(invoice.paidAt)} />
        <DetailRow label="Stripe ID" value={invoice.stripeInvoiceId ?? "—"} />
        {invoice.hostedInvoiceUrl ? (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Lien Stripe</dt>
            <dd>
              <a
                href={invoice.hostedInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Ouvrir <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
          </div>
        ) : null}
        {invoice.subscription ? (
          <DetailRow
            label="Abonnement"
            value={invoice.subscription.planName ?? "—"}
          />
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {invoice.status !== "PAID" ? (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={markingPaid}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {markingPaid ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Marquer payée
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Supprimer
          </button>
        </div>
      </dl>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

// --- Section abonnements ---

function SubscriptionsSection({
  subscriptions,
  isLoading,
}: {
  subscriptions: SubscriptionDTO[];
  isLoading: boolean;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <FileText className="h-5 w-5 text-primary" />
        Abonnements
      </h2>
      {isLoading ? (
        <LoadingBlock />
      ) : subscriptions.length === 0 ? (
        <EmptyBlock message="Aucun abonnement enregistré." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subscriptions.map((sub) => (
            <SubscriptionCard key={sub.id ?? sub.planName} subscription={sub} />
          ))}
        </div>
      )}
    </section>
  );
}

function SubscriptionCard({ subscription }: { subscription: SubscriptionDTO }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          {subscription.planName}
        </h3>
        <span
          className={cn(
            "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
            subTone(subscription.status),
          )}
        >
          {subLabel(subscription.status)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <dt className="text-muted-foreground">Cycle</dt>
          <dd className="font-medium text-foreground">
            {subscription.billingCycle === "ANNUAL" ? "Annuel" : "Mensuel"}
          </dd>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <dt className="text-muted-foreground">Montant</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatCurrency(subscription.amountCents, subscription.currency)}
          </dd>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <dt className="text-muted-foreground">Fin de période</dt>
          <dd className="font-medium text-foreground">
            {formatDate(subscription.currentPeriodEnd)}
          </dd>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <dt className="text-muted-foreground">Résiliation fin période</dt>
          <dd className="font-medium text-foreground">
            {subscription.cancelAtPeriodEnd ? "Oui" : "Non"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// --- Modal création facture ---

function CreateInvoiceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const create = useCreateInvoice();
  const [form, setForm] = useState({
    number: "",
    status: "PENDING",
    amountDueCents: "",
    amountPaidCents: "0",
    taxCents: "0",
    currency: "EUR",
    dueDate: "",
    periodStart: "",
    periodEnd: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountDue = Number(form.amountDueCents);
    if (!form.number.trim()) {
      toast.error("Le numéro de facture est requis.");
      return;
    }
    if (!Number.isFinite(amountDue) || amountDue < 0) {
      toast.error("Le montant dû doit être un nombre positif (en centimes).");
      return;
    }
    const payload: InvoiceDTO = {
      id: null,
      number: form.number.trim(),
      status: form.status,
      amountDueCents: amountDue,
      amountPaidCents: Number(form.amountPaidCents) || 0,
      taxCents: Number(form.taxCents) || 0,
      currency: form.currency || "EUR",
      periodStart: form.periodStart
        ? new Date(form.periodStart).toISOString()
        : null,
      periodEnd: form.periodEnd ? new Date(form.periodEnd).toISOString() : null,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      paidAt: null,
      lineItems: null,
      stripeInvoiceId: null,
      hostedInvoiceUrl: null,
      invoicePdfUrl: null,
      createdAt: new Date().toISOString(),
      tenant: { id: 0 },
      subscription: null,
    };
    create.mutate(payload, {
      onSuccess: () => {
        toast.success("Facture créée.");
        onCreated();
      },
      onError: (err) => toast.error(extractBackendError(err)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-5 shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Plus className="h-5 w-5 text-primary" />
            Nouvelle facture
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Numéro *">
            <input
              type="text"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="FAC-2026-001"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="PENDING">En attente</option>
                <option value="PAID">Payée</option>
                <option value="OVERDUE">En retard</option>
                <option value="CANCELLED">Annulée</option>
                <option value="DRAFT">Brouillon</option>
              </select>
            </Field>
            <Field label="Devise">
              <input
                type="text"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={8}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Montant dû (cents)">
              <input
                type="number"
                min={0}
                value={form.amountDueCents}
                onChange={(e) =>
                  setForm({ ...form, amountDueCents: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="15000"
                required
              />
            </Field>
            <Field label="Payé (cents)">
              <input
                type="number"
                min={0}
                value={form.amountPaidCents}
                onChange={(e) =>
                  setForm({ ...form, amountPaidCents: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0"
              />
            </Field>
            <Field label="TVA (cents)">
              <input
                type="number"
                min={0}
                value={form.taxCents}
                onChange={(e) => setForm({ ...form, taxCents: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Période début">
              <input
                type="date"
                value={form.periodStart}
                onChange={(e) =>
                  setForm({ ...form, periodStart: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Période fin">
              <input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Échéance">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// --- UI primitives ---

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-10 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Chargement…
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-1 text-xs font-medium hover:bg-amber-500/20"
      >
        <RefreshCw className="h-3 w-3" />
        Réessayer
      </button>
    </div>
  );
}