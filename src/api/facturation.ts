// Hooks & types API facturation électronique (domaine facturation-electronique).
// Version Spring Boot — InvoiceResource (/api/invoices) + SubscriptionResource
// (/api/subscriptions) + UsageRecordResource (/api/usage-records).
//
// Conventions :
// - DTOs JHipster = camelCase (Jackson naming strategy par défaut).
// - Champs @Lob (lineItems, metadataJson) = string JSON à parser défensivement côté
//   client via parseBillingJsonObject (réutilisé depuis @/api/billing).
// - Criteria JHipster : ?field.equals=value, ?field.contains=value.
// - PATCH = application/merge-patch+json.
// - InvoiceResource expose : POST "" (create), GET "" (list by criteria),
//   GET /count, GET /{id}, PUT /{id}, PATCH /{id}, DELETE /{id}.
//   Le tri n'est pas supporté côté serveur (List non paginée) → tri côté client.
// - IDs Long.

import axiosClient from "@/api/axiosClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  extractBackendError,
  parseBillingJsonObject,
  type AppUserRef,
  type BillingCycle,
  type SubscriptionStatus,
  type TenantRef,
} from "@/api/billing";

// --- Types ---

// Statuts facture e-invoicing. Le backend expose status comme un String libre
// (@Size(max=24)) — on déclare un union pour les valeurs métier connues tout en
// restant permissif (string) pour les valeurs inattendues.
export type InvoiceStatus =
  | "PAID"
  | "PENDING"
  | "OVERDUE"
  | "CANCELLED"
  | "DRAFT"
  | "OPEN"
  | "VOID"
  | "UNCOLLECTIBLE"
  | (string & {});

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

// Entrée de ligne de facture parsée depuis lineItems (@Lob). Forme souple : le
// backend stocke du JSON libre, on expose les champs les plus communs en
// optionnels sans imposer de schéma strict.
export interface InvoiceLineItem {
  description?: string | null;
  quantity?: number | null;
  unitAmountCents?: number | null;
  amountCents?: number | null;
  taxRate?: number | null;
  reference?: string | null;
  [key: string]: unknown;
}

// --- Query keys ---

export const facturationKeys = {
  all: ["facturation"] as const,
  invoices: (filter: object) =>
    ["facturation", "invoices", filter] as const,
  invoice: (id: number) => ["facturation", "invoice", id] as const,
  invoiceCount: (filter: object) =>
    ["facturation", "invoices", "count", filter] as const,
  subscriptions: (filter: object) =>
    ["facturation", "subscriptions", filter] as const,
  subscription: (id: number) => ["facturation", "subscription", id] as const,
  usageRecords: (filter: object) =>
    ["facturation", "usage-records", filter] as const,
};

// --- Helpers ---

// Réeexport pour les consommateurs de ce module (single source of vérité dans
// billing.ts, mais on évite un import croisé depuis la page).
export { extractBackendError, parseBillingJsonObject };

// Parse défensivement lineItems (@Lob) en tableau de lignes de facture.
export function parseInvoiceLineItems(
  raw: string | null | undefined,
): InvoiceLineItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (e): e is InvoiceLineItem =>
          typeof e === "object" && e !== null && !Array.isArray(e),
      );
    }
    if (typeof parsed === "object" && parsed !== null) {
      // Certains backends enveloppent les lignes dans { items: [...] }.
      const maybeItems = (parsed as { items?: unknown }).items;
      if (Array.isArray(maybeItems)) {
        return maybeItems.filter(
          (e): e is InvoiceLineItem =>
            typeof e === "object" && e !== null && !Array.isArray(e),
        );
      }
      return [parsed as InvoiceLineItem];
    }
    return [];
  } catch {
    return [];
  }
}

// --- Hooks InvoiceResource (CRUD JHipster) ---

export interface InvoiceListParams {
  status?: string;
  numberContains?: string;
  stripeInvoiceId?: string;
  tenantId?: number;
  subscriptionId?: number;
}

export function useInvoices(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: facturationKeys.invoices(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.status) requestParams["status.equals"] = params.status;
      if (params.numberContains)
        requestParams["number.contains"] = params.numberContains;
      if (params.stripeInvoiceId)
        requestParams["stripeInvoiceId.equals"] = params.stripeInvoiceId;
      if (params.tenantId != null)
        requestParams["tenantId.equals"] = String(params.tenantId);
      if (params.subscriptionId != null)
        requestParams["subscriptionId.equals"] = String(params.subscriptionId);
      const { data } = await axiosClient.get<InvoiceDTO[]>("/api/invoices", {
        params: requestParams,
      });
      // Tri côté client par createdAt desc (le endpoint retourne une List non
      // paginée, sans support de tri serveur).
      return [...data].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });
}

export function useInvoice(id: number | null) {
  return useQuery({
    queryKey: facturationKeys.invoice(id ?? -1),
    queryFn: async () => {
      if (id == null) return null;
      const { data } = await axiosClient.get<InvoiceDTO | null>(
        `/api/invoices/${id}`,
      );
      return data;
    },
    enabled: id != null,
  });
}

export function useInvoiceCount(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: facturationKeys.invoiceCount(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.status) requestParams["status.equals"] = params.status;
      if (params.numberContains)
        requestParams["number.contains"] = params.numberContains;
      if (params.stripeInvoiceId)
        requestParams["stripeInvoiceId.equals"] = params.stripeInvoiceId;
      if (params.tenantId != null)
        requestParams["tenantId.equals"] = String(params.tenantId);
      if (params.subscriptionId != null)
        requestParams["subscriptionId.equals"] = String(params.subscriptionId);
      const { data } = await axiosClient.get<number>("/api/invoices/count", {
        params: requestParams,
      });
      return data;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InvoiceDTO) => {
      const { data } = await axiosClient.post<InvoiceDTO>(
        "/api/invoices",
        input,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturationKeys.all }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: InvoiceDTO }) => {
      const { data } = await axiosClient.put<InvoiceDTO>(
        `/api/invoices/${id}`,
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturationKeys.all }),
  });
}

export function usePatchInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<InvoiceDTO>;
    }) => {
      const { data } = await axiosClient.patch<InvoiceDTO | null>(
        `/api/invoices/${id}`,
        patch,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturationKeys.all }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/api/invoices/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturationKeys.all }),
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
    queryKey: facturationKeys.subscriptions(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.planName) requestParams["planName.equals"] = params.planName;
      if (params.status) requestParams["status.equals"] = params.status;
      if (params.billingCycle)
        requestParams["billingCycle.equals"] = params.billingCycle;
      if (params.stripeCustomerId)
        requestParams["stripeCustomerId.equals"] = params.stripeCustomerId;
      const { data } = await axiosClient.get<SubscriptionDTO[]>(
        "/api/subscriptions",
        { params: requestParams },
      );
      return data;
    },
  });
}

export function useSubscription(id: number | null) {
  return useQuery({
    queryKey: facturationKeys.subscription(id ?? -1),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: facturationKeys.all }),
  });
}

export function usePatchSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<SubscriptionDTO>;
    }) => {
      const { data } = await axiosClient.patch<SubscriptionDTO | null>(
        `/api/subscriptions/${id}`,
        patch,
        { headers: { "Content-Type": "application/merge-patch+json" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: facturationKeys.all }),
  });
}

// --- Hooks UsageRecordResource (CRUD JHipster) ---

export interface UsageRecordListParams {
  metric?: string;
}

export function useUsageRecords(params: UsageRecordListParams = {}) {
  return useQuery({
    queryKey: facturationKeys.usageRecords(params),
    queryFn: async () => {
      const requestParams: Record<string, string> = {};
      if (params.metric) requestParams["metric.equals"] = params.metric;
      const { data } = await axiosClient.get<UsageRecordDTO[]>(
        "/api/usage-records",
        { params: requestParams },
      );
      return data;
    },
  });
}