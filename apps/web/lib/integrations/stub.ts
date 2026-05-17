import type {
  AccountingInvoice,
  AccountingProvider,
  BaseProviderContext,
  EInvoiceProvider,
  MarketplaceProvider,
  MessageArgs,
  MessagingProvider,
  ProviderMeta,
  ShipmentArgs,
  ShippingProvider,
  SyncResult,
} from "./types";

/**
 * Stub implementations that satisfy the category interfaces but don't make
 * real network calls. The UI uses these so the user can click "Connect" and
 * see the flow end-to-end; replace with real implementations once provider
 * credentials are available.
 *
 * Each method returns `ok: false` with a clear "stub" message so production
 * code can detect and avoid acting on the result.
 */

function notImplemented(provider: string, action: string): SyncResult {
  return {
    ok: false,
    processed: 0,
    errors: 1,
    message: `${provider} ${action} entegrasyonu henüz hazır değil — gerçek sözleşme bekleniyor.`,
  };
}

export function makeMarketplaceStub(meta: ProviderMeta): MarketplaceProvider {
  return {
    meta,
    async pushInventory(_ctx: BaseProviderContext, items) {
      return { ...notImplemented(meta.id, "push inventory"), processed: items.length };
    },
    async pullOrders(_ctx: BaseProviderContext, _since: Date) {
      return notImplemented(meta.id, "pull orders");
    },
  };
}

export function makeAccountingStub(meta: ProviderMeta): AccountingProvider {
  return {
    meta,
    async pushInvoice(_ctx: BaseProviderContext, _invoice: AccountingInvoice) {
      return notImplemented(meta.id, "push invoice");
    },
  };
}

export function makeShippingStub(meta: ProviderMeta): ShippingProvider {
  return {
    meta,
    async createShipment(_ctx: BaseProviderContext, _args: ShipmentArgs) {
      return { ok: false, error: `${meta.label} entegrasyonu stub — sözleşme bekleniyor` };
    },
    async trackShipment(_ctx: BaseProviderContext, _trackingNumber: string) {
      return { ok: false };
    },
  };
}

export function makeEInvoiceStub(meta: ProviderMeta): EInvoiceProvider {
  return {
    meta,
    async issue(_ctx: BaseProviderContext, _invoice: AccountingInvoice) {
      return { ok: false, error: `${meta.label} e-fatura entegrasyonu stub` };
    },
  };
}

export function makeMessagingStub(meta: ProviderMeta): MessagingProvider {
  return {
    meta,
    async send(_ctx: BaseProviderContext, _args: MessageArgs) {
      return { ok: false, error: `${meta.label} mesajlaşma entegrasyonu stub` };
    },
  };
}
