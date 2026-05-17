import type { ProviderMeta } from "./types";

/**
 * Central registry of all integration providers. The UI iterates this list
 * to render the "Available Integrations" page. The runtime layer (sync jobs,
 * inbound webhooks) imports the actual implementation by id.
 *
 * Stub providers are marked with `stub: true` — they have UI + schema but
 * the network call is a no-op until real API contracts are wired.
 */
export interface RegistryEntry {
  meta: ProviderMeta;
  stub?: boolean;
}

export const INTEGRATIONS: RegistryEntry[] = [
  // ---- Marketplaces ----
  {
    stub: true,
    meta: {
      id: "shopify",
      category: "marketplace",
      label: "Shopify",
      description: "Mağazanızdaki ürünleri Shopify'a senkronize edin, siparişleri buraya çekin.",
      docsUrl: "https://shopify.dev/api/admin",
      supportsInboundWebhooks: true,
      configSchema: [
        { key: "shop", label: "Mağaza", type: "text", required: true, placeholder: "my-shop.myshopify.com" },
        { key: "accessToken", label: "Admin API Access Token", type: "password", required: true, helpText: "Shopify Admin → Apps → Develop apps" },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "trendyol",
      category: "marketplace",
      label: "Trendyol",
      description: "Trendyol satıcı paneliyle iki yönlü senkronizasyon.",
      docsUrl: "https://developers.trendyol.com",
      supportsInboundWebhooks: false,
      configSchema: [
        { key: "supplierId", label: "Satıcı ID", type: "text", required: true },
        { key: "apiKey", label: "API Key", type: "password", required: true },
        { key: "apiSecret", label: "API Secret", type: "password", required: true },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "hepsiburada",
      category: "marketplace",
      label: "Hepsiburada",
      description: "Hepsiburada listing + order senkron.",
      configSchema: [
        { key: "merchantId", label: "Merchant ID", type: "text", required: true },
        { key: "username", label: "API Username", type: "text", required: true },
        { key: "password", label: "API Password", type: "password", required: true },
      ],
    },
  },

  // ---- Accounting ----
  {
    stub: true,
    meta: {
      id: "parasut",
      category: "accounting",
      label: "Paraşüt",
      description: "Sipariş → fatura senkronu. Müşteri/tedarikçi otomatik eşleştirme.",
      docsUrl: "https://apidocs.parasut.com",
      configSchema: [
        { key: "companyId", label: "Şirket ID", type: "text", required: true },
        { key: "clientId", label: "Client ID", type: "text", required: true },
        { key: "clientSecret", label: "Client Secret", type: "password", required: true },
        { key: "username", label: "Kullanıcı", type: "text", required: true },
        { key: "password", label: "Şifre", type: "password", required: true },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "logo_mikro",
      category: "accounting",
      label: "Logo Mikro Fly",
      description: "Logo Mikro Fly REST API entegrasyonu.",
      configSchema: [
        { key: "endpoint", label: "API Endpoint", type: "url", required: true },
        { key: "username", label: "Kullanıcı", type: "text", required: true },
        { key: "password", label: "Şifre", type: "password", required: true },
        { key: "firmNo", label: "Firma No", type: "text", required: true },
        { key: "periodNo", label: "Dönem No", type: "text" },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "bizimhesap",
      category: "accounting",
      label: "Bizimhesap",
      description: "Bizimhesap fatura + cari senkron.",
      configSchema: [
        { key: "apiKey", label: "API Key", type: "password", required: true },
      ],
    },
  },

  // ---- E-Invoice ----
  {
    stub: true,
    meta: {
      id: "foriba",
      category: "e_invoice",
      label: "Foriba e-Fatura",
      description: "Foriba/Sovos e-fatura ve e-arşiv servisleri.",
      configSchema: [
        { key: "username", label: "Kullanıcı", type: "text", required: true },
        { key: "password", label: "Şifre", type: "password", required: true },
        { key: "vknTckn", label: "VKN/TCKN", type: "text", required: true },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "mysoft_efatura",
      category: "e_invoice",
      label: "Mysoft e-Fatura",
      description: "Mysoft entegrasyon hattı.",
      configSchema: [
        { key: "apiKey", label: "API Key", type: "password", required: true },
        { key: "vknTckn", label: "VKN/TCKN", type: "text", required: true },
      ],
    },
  },

  // ---- Shipping ----
  {
    stub: true,
    meta: {
      id: "aras_kargo",
      category: "shipping",
      label: "Aras Kargo",
      description: "Aras Kargo SOAP servisi ile gönderi oluşturma + takip.",
      configSchema: [
        { key: "username", label: "Kullanıcı", type: "text", required: true },
        { key: "password", label: "Şifre", type: "password", required: true },
        { key: "customerCode", label: "Müşteri Kodu", type: "text", required: true },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "yurtici_kargo",
      category: "shipping",
      label: "Yurtiçi Kargo",
      description: "Yurtiçi Kargo entegrasyon servisi.",
      configSchema: [
        { key: "username", label: "Kullanıcı", type: "text", required: true },
        { key: "password", label: "Şifre", type: "password", required: true },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "mng_kargo",
      category: "shipping",
      label: "MNG Kargo",
      description: "MNG Kargo API entegrasyonu.",
      configSchema: [
        { key: "apiKey", label: "API Key", type: "password", required: true },
        { key: "customerNumber", label: "Müşteri Numarası", type: "text", required: true },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "ptt_kargo",
      category: "shipping",
      label: "PTT Kargo",
      description: "PTT Kargo entegrasyon hattı.",
      configSchema: [
        { key: "username", label: "Kullanıcı", type: "text", required: true },
        { key: "password", label: "Şifre", type: "password", required: true },
      ],
    },
  },

  // ---- Messaging ----
  {
    stub: true,
    meta: {
      id: "whatsapp_cloud",
      category: "messaging",
      label: "WhatsApp Cloud API",
      description: "Meta WhatsApp Business Cloud API ile şablonlu mesajlar.",
      docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
      configSchema: [
        { key: "phoneNumberId", label: "Phone Number ID", type: "text", required: true },
        { key: "accessToken", label: "Access Token", type: "password", required: true },
      ],
    },
  },
  {
    stub: true,
    meta: {
      id: "twilio",
      category: "messaging",
      label: "Twilio",
      description: "Twilio üzerinden SMS / WhatsApp.",
      configSchema: [
        { key: "accountSid", label: "Account SID", type: "text", required: true },
        { key: "authToken", label: "Auth Token", type: "password", required: true },
        { key: "from", label: "Gönderici", type: "text", required: true, placeholder: "+90...", helpText: "Onaylı sender" },
      ],
    },
  },
];

export function findProvider(id: string): RegistryEntry | undefined {
  return INTEGRATIONS.find((e) => e.meta.id === id);
}
