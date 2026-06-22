import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Hooks API facturation (LOT billing). Version Spring Boot.
// Backend :
// - BillingResource (/api/billing — custom, shapes ad hoc) : GET /overview, GET /pricing,
//   POST /checkout, POST /portal, GET /invoices, GET /invoices/{id}, GET /invoices/{id}/pdf.
// - SubscriptionResource (/api/subscriptions — CRUD JHipster + Criteria).
// - InvoiceResource (/api/invoices — CRUD JHipster + Criteria).
// - PaymentMethodResource (/api/payment-methods — CRUD JHipster + Criteria).
// - UsageRecordResource (/api/usage-records — CRUD JHipster + Criteria).
//
// Conventions :
// - DTOs JHipster = camelCase (naming strategy Jackson par défaut).
// - /api/billing/overview renvoie un Map<String, Object> : les clés de premier niveau sont
//   snake_case (recent_invoices, upgrade_suggestion, stripe_mock, checkout_supported) tandis
//   que les champs des sous-objets (SubscriptionView, QuotaStatus, MetricUsage, InvoiceView,
//   UpgradeSuggestion) sont camelCase (champs publics Java sérialisés tels quels).
// - Champs @Lob (metadataJson, lineItems, lineItemsJson, payload) = string JSON à parser
//   défensivement côté client via parseBillingJsonObject.
// - Critère JHipster : ?field.equals=value, ?field.contains=value.
// - PATCH = application/merge-patch+json.

// --- Types communs ---

export interface TenantRef {
  id: number;
  slug?: string | null;
  name?: string | null;
  plan?: string | null;
  status?: string | null;
}

export interface AppUserRef {
  id: number;
  email?: string | null;
}

// --- BillingResource : shapes ad hoc ---

export interface PlanQuotas {
  aiTokens: number | null;
  aiRequests: number | null;
  modulesExecutions: number | null;
  exports: number | null;
  embeddings: number | null;
  copilotTurns: number | null;
}

export interface PlanDefinition {
  name: string;
  label: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  currency: string;
  trialDays: number;
  stripePriceMonthly: string | null;
  stripePriceAnnual: string | null;
  features: string[];
  quotas: PlanQuotas;
  isPublic: boolean;
  highlight: boolean;
}

export interface SubscriptionView {
  id: number | null;
  tenantId: string;
  planName: string;
  planLabel: string;
  status: string;
  billingCycle: string;
  amountCents: number;
  currency: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  isTrial: boolean;
  inGracePeriod: boolean;
}

export interface MetricUsage {
  metric: string;
  label: string;
  used: number;
  limit: number | null; // null = illimité
  percent: number;
  status: "ok" | "warn" | "critical" | "exceeded" | "unlimited" | string;
}

export interface QuotaStatus {
  tenantId: string;
  planName: string;
  periodStart: string;
  metrics: MetricUsage[];
  overallStatus: "ok" | "warn" | "critical" | "exceeded" | "unlimited" | string;
}

export interface InvoiceView {
  id: string;
  tenantId: string;
  number: string;
  status: string;
  amountDueCents: number;
  amountPaidCents: number;
  taxCents: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItemsJson: string | null; // @Lob
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  stripeInvoiceId: string | null;
}

export interface UpgradeSuggestion {
  currentPlan: string;
  suggestedPlan: string;
  reason: string;
  triggers: string[];
  monthlyPriceCents: number;
  annualPriceCents: number;
}

// /api/billing/overview = Map<String, Object> : clés top-level snake_case, sous-objets
// camelCase. On déclare les deux casings (snake + camel) en optionnels pour robustesse.
export interface BillingOverview {
  subscription?: SubscriptionView | null;
  quotas?: QuotaStatus | null;
  recent_invoices?: InvoiceView[];
  recentInvoices?: InvoiceView[];
  upgrade_suggestion?: UpgradeSuggestion | null;
  upgradeSuggestion?: UpgradeSuggestion | null;
  stripe_mock?: boolean;
  stripeMock?: boolean;
  checkout_supported?: boolean;
  checkoutSupported?: boolean;
}

export interface CheckoutRequest {
  planName: string;
  cycle: "monthly" | "annual";
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
  mock: boolean;
  plan: string;
  cycle: string;
}

export interface PortalResult {
  url: string;
  session_id?: string;
  sessionId?: string;
  mock?: boolean;
}

// --- DTOs JHipster (camelCase) ---

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | string;

export type BillingCycle = "MONTHLY" | "ANNUAL" | string;

export interface SubscriptionDTO {
  id: number | null;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amountCents: number | null;
  currency: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  metadataJson: string | null; // @Lob
  createdAt: string;
  updatedAt: string;
  tenant: TenantRef;
}

export interface InvoiceDTO {
  id: number | null;
  number: string;
  status: string;
  amountDueCents: number;
  amountPaidCents: number;
  taxCents: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  paidAt: string | null;
  lineItems: string | null; // @Lob
  stripeInvoiceId: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  createdAt: string;
  tenant: TenantRef;
  subscription?: SubscriptionDTO | null;
}

export interface PaymentMethodDTO {
  id: number | null;
  kind: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  stripePaymentMethodId: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  tenant: TenantRef;
}

export interface UsageRecordDTO {
  id: number | null;
  metric: string;
  quantity: number;
  unitCostMicroEur: number | null;
  metadataJson: string | null; // @Lob
  recordedAt: string;
  tenant: TenantRef;
  user?: AppUserRef | null;
}

export interface BillingEventDTO {
  id: number | null;
  source: string;
  eventType: string;
  stripeEventId: string | null;
  payload: string | null; // @Lob
  processed: boolean;
  processedAt: string | null;
  error: string | null; // @Lob
  receivedAt: string;
  tenant?: TenantRef | null;
}

// --- Query keys ---

export const billingKeys = {
  all: ["billing"] as const,
  overview: () => ["billing", "overview"] as const,
  pricing: () => ["billing", "pricing"] as const,
  invoices: (limit: number) => ["billing", "invoices", { limit }] as const,
  subscriptions: (filter: object) =>
    ["billing", "subscriptions", filter] as const,
  subscription: (id: number) => ["billing", "subscription", id] as const,
  jhipsterInvoices: (filter: object) =>
    ["billing", "jhi-invoices", filter] as const,
  paymentMethods: (filter: object) =>
    ["billing", "payment-methods", filter] as const,
  usageRecords: (filter: object) =>
    ["billing", "usage-records", filter] as const,
};

// --- Helpers ---

// Parse défensivement un @Lob contenant un objet JSON. Renvoie null si absent/mal formé.
export function parseBillingJsonObject(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Récupère un champ d'un overview en acceptant snake_case OU camelCase (le backend renvoie
// un Map<String, Object> dont les clés sont snake_case, mais on reste résilient).
export function overviewField<T>(
  overview: BillingOverview | undefined | null,
  snake: keyof BillingOverview,
  camel: keyof BillingOverview,
): T | null {
  if (!overview) return null;
  const v = overview[snake] ?? overview[camel];
  return (v as T | undefined) ?? null;
}

// Extrait un message d'erreur lisible depuis une erreur axios (shape backend JHipster /
// ResponseStatusException). Retourne toujours une chaîne non vide.
export function extractBackendError(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as {
      response?: {
        data?: { error?: { message?: string } | string; message?: string } | string;
        statusText?: string;
      };
    };
    const data = e.response?.data;
    if (data) {
      if (typeof data === "string" && data.trim()) return data;
      if (typeof data === "object") {
        const obj = data as { error?: { message?: string } | string; message?: string };
        const error = obj.error;
        const errorMsg =
          typeof error === "object" && error !== null ? error.message : undefined;
        const msg = errorMsg ?? obj.message;
        if (typeof msg === "string" && msg.trim()) return msg;
      }
    }
    if (e.response?.statusText) return e.response.statusText;
  }
  return "Une erreur est survenue. Réessayez.";
}

// Déclenche le téléchargement navigateur d'un blob PDF.
function triggerPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libère l'URL après un court délai pour laisser le navigateur initier le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Hooks BillingResource (custom) ---

export function useBillingOverview() {
  return useQuery({
    queryKey: billingKeys.overview(),
    queryFn: async () => {
      const { data } = await axiosClient.get<BillingOverview>("/api/billing/overview");
      return data;
    },
    refetchInterval: 60000,
  });
}

export function useBillingPricing() {
  return useQuery({
    queryKey: billingKeys.pricing(),
    queryFn: async () => {
      const { data } = await axiosClient.get<PlanDefinition[]>("/api/billing/pricing");
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useBillingInvoices(limit = 10) {
  return useQuery({
    queryKey: billingKeys.invoices(limit),
    queryFn: async () => {
      const { data } = await axiosClient.get<InvoiceView[]>("/api/billing/invoices", {
        params: { limit },
      });
      return data;
    },
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckoutRequest) => {
      // Le backend attend du snake_case (CheckoutRequest.plan_name/cycle/success_url/cancel_url).
      const body = {
        plan_name: input.planName,
        cycle: input.cycle,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      };
      const { data } = await axiosClient.post<CheckoutResult>(
        "/api/billing/checkout",
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

export function useOpenPortal() {
  return useMutation({
    mutationFn: async (returnUrl?: string) => {
      const body = { return_url: returnUrl ?? `${window.location.origin}/billing` };
      const { data } = await axiosClient.post<PortalResult>(
        "/api/billing/portal",
        body,
      );
      return data;
    },
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async ({ id, number }: { id: string; number: string }) => {
      const response = await axiosClient.get(`/api/billing/invoices/${id}/pdf`, {
        responseType: "blob",
      });
      const blob = response.data as Blob;
      triggerPdfDownload(blob, `facture_${number}.pdf`);
      return { id };
    },
  });
}

// --- Hooks SubscriptionResource (CRUD JHipster) ---

export interface SubscriptionListParams {
  planName?: string;
  status?: string;
  billingCycle?: string;
  stripeCustomerId?: string;
}

export function useSubscriptions(params: SubscriptionListParams = {}) {
  return useQuery({
    queryKey: billingKeys.subscriptions(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.planName) requestParams["planName.equals"] = params.planName;
      if (params.status) requestParams["status.equals"] = params.status;
      if (params.billingCycle) requestParams["billingCycle.equals"] = params.billingCycle;
      if (params.stripeCustomerId)
        requestParams["stripeCustomerId.equals"] = params.stripeCustomerId;
      const { data } = await axiosClient.get<SubscriptionDTO[]>("/api/subscriptions", {
        params: requestParams,
      });
      return data;
    },
  });
}

export function useSubscription(id: number | null) {
  return useQuery({
    queryKey: billingKeys.subscription(id ?? -1),
    queryFn: async () => {
      if (id == null) return null;
      const { data } = await axiosClient.get<SubscriptionDTO | null>(
        `/api/subscriptions/${id}`,
      );
      return data;
    },
    enabled: id != null,
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubscriptionDTO) => {
      const { data } = await axiosClient.post<SubscriptionDTO>(
        "/api/subscriptions",
        input,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: SubscriptionDTO }) => {
      const { data } = await axiosClient.put<SubscriptionDTO>(
        `/api/subscriptions/${id}`,
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

export function usePatchSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<SubscriptionDTO> }) => {
      const { data } = await axiosClient.patch<SubscriptionDTO | null>(
        `/api/subscriptions/${id}`,
        patch,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/subscriptions/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

// --- Hooks InvoiceResource (CRUD JHipster) ---

export interface InvoiceListParams {
  status?: string;
  numberContains?: string;
  stripeInvoiceId?: string;
}

export function useJhipsterInvoices(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: billingKeys.jhipsterInvoices(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.status) requestParams["status.equals"] = params.status;
      if (params.numberContains) requestParams["number.contains"] = params.numberContains;
      if (params.stripeInvoiceId)
        requestParams["stripeInvoiceId.equals"] = params.stripeInvoiceId;
      const { data } = await axiosClient.get<InvoiceDTO[]>("/api/invoices", {
        params: requestParams,
      });
      return data;
    },
  });
}

export function usePatchInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<InvoiceDTO> }) => {
      const { data } = await axiosClient.patch<InvoiceDTO | null>(
        `/api/invoices/${id}`,
        patch,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

// --- Hooks PaymentMethodResource (CRUD JHipster) ---

export interface PaymentMethodListParams {
  kind?: string;
  isDefault?: boolean;
  stripeCustomerId?: string;
}

export function usePaymentMethods(params: PaymentMethodListParams = {}) {
  return useQuery({
    queryKey: billingKeys.paymentMethods(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.kind) requestParams["kind.equals"] = params.kind;
      if (params.isDefault != null)
        requestParams["isDefault.equals"] = String(params.isDefault);
      if (params.stripeCustomerId)
        requestParams["stripeCustomerId.equals"] = params.stripeCustomerId;
      const { data } = await axiosClient.get<PaymentMethodDTO[]>(
        "/api/payment-methods",
        { params: requestParams },
      );
      return data;
    },
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/payment-methods/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}

// --- Hooks UsageRecordResource (CRUD JHipster) ---

export interface UsageRecordListParams {
  metric?: string;
}

export function useUsageRecords(params: UsageRecordListParams = {}) {
  return useQuery({
    queryKey: billingKeys.usageRecords(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.metric) requestParams["metric.equals"] = params.metric;
      const { data } = await axiosClient.get<UsageRecordDTO[]>("/api/usage-records", {
        params: requestParams,
      });
      return data;
    },
  });
}