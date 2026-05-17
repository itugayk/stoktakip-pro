/**
 * Common types for the integrations layer.
 *
 * Each provider implements one of the category interfaces below. Connection
 * credentials are stored in `integration_connections.config` (JSONB) and
 * passed in via the `BaseProviderContext`.
 */

export type IntegrationCategory = "marketplace" | "accounting" | "shipping" | "e_invoice" | "messaging";

export interface ProviderMeta {
  id: string;                       // 'shopify', 'parasut', 'aras_kargo'
  category: IntegrationCategory;
  label: string;
  description: string;
  /** Form schema for the connection setup screen. */
  configSchema: ProviderConfigField[];
  /** Web URL for the user to find their credentials. */
  docsUrl?: string;
  /** Whether this provider supports webhooks back to us. */
  supportsInboundWebhooks?: boolean;
}

export interface ProviderConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

export interface BaseProviderContext {
  companyId: string;
  connectionId: string;
  config: Record<string, string>;
}

export interface SyncResult {
  ok: boolean;
  processed: number;
  errors: number;
  message?: string;
}

// ---- Category interfaces ----

export interface MarketplaceProvider {
  meta: ProviderMeta;
  /** Push our products + inventory levels to the marketplace. */
  pushInventory(ctx: BaseProviderContext, products: { sku: string; quantity: number; price?: number }[]): Promise<SyncResult>;
  /** Pull new orders from the marketplace since `since`. */
  pullOrders(ctx: BaseProviderContext, since: Date): Promise<SyncResult>;
}

export interface AccountingProvider {
  meta: ProviderMeta;
  /** Push an invoice (created from a PO/SO) to the accounting system. */
  pushInvoice(ctx: BaseProviderContext, invoice: AccountingInvoice): Promise<SyncResult>;
}

export interface AccountingInvoice {
  number: string;
  date: string;
  partner: { name: string; taxId?: string };
  items: { name: string; quantity: number; unitPrice: number; taxRate: number }[];
}

export interface ShippingProvider {
  meta: ProviderMeta;
  /** Create a shipment label for a sales order. Returns tracking number. */
  createShipment(ctx: BaseProviderContext, args: ShipmentArgs): Promise<{ ok: boolean; trackingNumber?: string; labelUrl?: string; error?: string }>;
  /** Fetch current status of a tracking number. */
  trackShipment(ctx: BaseProviderContext, trackingNumber: string): Promise<{ ok: boolean; status?: string; lastUpdate?: string }>;
}

export interface ShipmentArgs {
  to: { name: string; phone?: string; address: string };
  weightKg?: number;
  parcelCount?: number;
  cashOnDelivery?: number;
  reference?: string;
}

export interface EInvoiceProvider {
  meta: ProviderMeta;
  /** Issue an e-fatura for a sales order. */
  issue(ctx: BaseProviderContext, invoice: AccountingInvoice): Promise<{ ok: boolean; uuid?: string; pdfUrl?: string; error?: string }>;
}

export interface MessagingProvider {
  meta: ProviderMeta;
  /** Send a templated WhatsApp/SMS message. */
  send(ctx: BaseProviderContext, args: MessageArgs): Promise<{ ok: boolean; messageId?: string; error?: string }>;
}

export interface MessageArgs {
  to: string;                       // E.164 phone number
  template: string;                 // Provider template id
  variables?: Record<string, string>;
}
