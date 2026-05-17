# StokTakip Pro — Gelecek Fazlar Rotası (5 → 6 → 7 → 8 → 9)

> 0-1-3-2-4 tamamlandıktan sonra. Artık temel altyapı + UX + saha kullanımı + akıllı stok + sipariş akışları yerinde. Bu noktadan sonra **paraya, ekibe ve diferansiyasyona** geçiş.

**Önerilen sıra:** 5 (raporlama) → 6 (çoklu kullanıcı) → 7 (entegrasyonlar) → 8 (AI) → 9 (yayın hazırlığı).
**Alternatif:** Müşteri talebi varsa Faz 7'yi öne çek; Faz 8 her zaman son.

---

# FAZ 5 — Raporlama & İçgörü

**Amaç:** Veriyi karara dönüştürmek. "Stok kayıt sistemi"nden "iş zekası" katmanına geçiş.

**Süre:** 1–2 hafta · **Bağımlılık:** Faz 2 (analiz fonksiyonları), Faz 4 (sipariş verisi)

## 5.1 · Özelleştirilebilir Dashboard

**Paket:** `@dnd-kit/core` + `@dnd-kit/sortable`.

**Dosyalar:**
```
apps/web/components/dashboard/widgets/
├── widget-registry.ts        # tüm widget tipleri + meta
├── grid-layout.tsx           # sürükle-bırak grid
├── widget-frame.tsx          # her widget'ın çerçevesi (başlık, ayar, kaldır)
├── stat-card.widget.tsx
├── chart-line.widget.tsx
├── chart-pie.widget.tsx
├── recent-movements.widget.tsx
├── expiring-lots.widget.tsx
├── reorder-suggestions.widget.tsx
└── kpi-comparison.widget.tsx
```

**Şema (`011_dashboards.sql`):**
```sql
CREATE TABLE user_dashboards (
  id UUID PK, user_id UUID, company_id UUID, name TEXT,
  layout JSONB,            -- [{ id, type, x, y, w, h, config }]
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**UI:** "Düzenle" toggle → widget ekle/çıkar/yeniden boyutlandır → kaydet. Çoklu dashboard (sekmeler).

**Kabul:** Yeni widget tipi eklemek `widget-registry.ts`'e tek bir entry koymakla mümkün olsun.

---

## 5.2 · Karşılaştırmalı Raporlar

**Action:**
```ts
compareReport<T>(params: {
  metric: 'sales' | 'purchases' | 'movements' | 'turnover';
  periodA: { from: Date; to: Date };
  periodB: { from: Date; to: Date };
  dimension?: 'product' | 'category' | 'warehouse' | 'customer';
}): Promise<Result<{ rows: T[]; totals: { a: number; b: number; delta: number; pct: number } }>>
```

**UI:** İki dönem seçici (presetler: bu ay/geçen ay, bu yıl/geçen yıl, custom) + delta sütunu renkli (↑ yeşil / ↓ kırmızı).

---

## 5.3 · Excel İçe Aktarma (Toplu Yükleme)

**Paket:** `xlsx` (SheetJS) veya `exceljs`.

**Dosyalar:**
```
apps/web/app/dashboard/products/import/page.tsx
apps/web/lib/import/products.ts
apps/web/lib/import/template.ts       # şablon xlsx üret
apps/web/lib/import/validator.ts      # zod + row-level error
```

**Akış:**
1. "Şablon indir" → kolonlar dolu örnek xlsx
2. Doldurulmuş dosyayı yükle
3. Önizleme tablosu: yeşil satır = OK, kırmızı = hata (her satıra detaylı sebep)
4. "Yalnız geçerlileri içe aktar" veya "Hata listesini xlsx olarak indir"
5. İçe aktarma sonrası özet: 142 eklendi, 8 atlandı

**Action:**
```ts
importProducts(rows: ProductImportRow[]): Promise<Result<{
  inserted: number; updated: number; errors: { row: number; field: string; message: string }[]
}>>
```

**Uygulama alanı:** Ürünler, Müşteriler, Tedarikçiler, Açılış Stokları, Fiyat Listeleri.

---

## 5.4 · Excel/CSV Dışa Aktarma

**Helper:** `lib/export/xlsx.ts`
```ts
exportToXLSX(filename: string, sheets: { name: string; rows: Record<string, unknown>[]; columns?: ColumnDef[] }[]): void
```

**DataTable entegrasyonu:** Her tabloda "Dışa aktar" butonu → filtreli/seçili veriyi xlsx olarak indirir. Formatla (tarih, para, %).

**Hazır rapor exportları:**
- Stok bakiyesi (depo bazlı)
- Stok hareket dökümü (tarih aralığı)
- Cari ekstre (müşteri/tedarikçi bazlı)
- KDV raporu (alış/satış)

---

## 5.5 · Markalı PDF Raporları

**Paket:** Mevcut jsPDF + autotable.

**Dosyalar:**
```
apps/web/lib/pdf/
├── base-pdf.ts          # logo, başlık, footer, sayfa numarası
├── report-pdf.ts        # tablo bazlı rapor
├── invoice-pdf.ts       # 4.9'da başlamıştı, burada tamamla
└── pick-list-pdf.ts     # 4.3 için
```

**Şirket marka ayarları:** `companies.settings.branding`:
```json
{ "logo_url": "...", "primary_color": "#6366f1", "footer_text": "...", "iban": "...", "tax_office": "..." }
```

---

## 5.6 · Kâr/Zarar Analizi

**Hesap yöntemleri (ayarlardan seçilir):**
- **FIFO** — First in, first out (en yaygın)
- **AVG** — Ağırlıklı ortalama maliyet
- **LIFO** — Last in, first out (TR'de muhasebe için sınırlı)

**Materialized view (`012_cogs.sql`):**
```sql
CREATE MATERIALIZED VIEW mv_product_profitability AS
SELECT product_id,
       SUM(sale_qty * sale_price) AS revenue,
       SUM(sale_qty * cogs_unit) AS cogs,
       SUM(sale_qty * (sale_price - cogs_unit)) AS gross_profit,
       (...) AS gross_margin
FROM ...;
CREATE INDEX ON mv_product_profitability(product_id);
-- günlük refresh: pg_cron veya Edge Function
```

**UI:** Raporlar > Kârlılık — ürün/kategori/depo bazlı; sortable + drill-down.

---

## 5.7 · Trend & Mevsimsellik

**Görseller (recharts):**
- Yıllık çakıştırma (line chart, geçen yıl vs. bu yıl)
- Brush + zoom
- 7 günlük hareketli ortalama overlay
- Heatmap: ay × ürün satış yoğunluğu

**Dosya:** `components/charts/trend-overlay.tsx`

---

## 5.8 · Zamanlanmış Raporlar

**Şema:**
```sql
CREATE TABLE scheduled_reports (
  id UUID PK, company_id UUID, name TEXT,
  report_type TEXT,                     -- 'stock_balance','sales_summary',...
  schedule TEXT,                        -- cron: '0 8 * * 1' (her pzt 08:00)
  recipients TEXT[],                    -- email[]
  format TEXT,                          -- 'pdf'|'xlsx'
  filters JSONB,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ, last_status TEXT
);
```

**Çalıştırıcı:** Supabase Edge Function `report-runner` veya Vercel Cron + Resend email.

**UI:** `/dashboard/reports/schedules` CRUD.

---

## 5.9 · Saved Views (Kaydedilmiş Görünümler)

DataTable'daki filtreyi "Pano olarak kaydet" → solda navigasyonda alt menü olarak görünür.

**Şema (paylaşımlı views için):**
```sql
CREATE TABLE saved_views (
  id UUID PK, user_id UUID, company_id UUID, scope TEXT, -- 'products'|'movements'|...
  name TEXT, filters JSONB, columns JSONB, sort JSONB,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5.10 · KPI Hedefleri & Anomali Çubuğu

**Şema:**
```sql
CREATE TABLE kpi_targets (
  company_id UUID, metric TEXT, period TEXT, target NUMERIC, ...
);
```

**Dashboard'da:** "Bu ay satış: 145K / 200K hedef ✓ %72". Hedef sapması renklendirilir; Faz 8'de anomali AI bağlanır.

---

# FAZ 6 — Çoklu Kullanıcı & İşbirliği

**Amaç:** Tek kişilik kullanımdan ekip kullanımına geçiş. Eski kayıt sisteminden işbirliği platformuna.

**Süre:** 1–2 hafta · **Bağımlılık:** Faz 0 (auth katmanı), Faz 2.8 (audit UI temeli)

## 6.1 · Yetki Matrisi UI

Mevcut: 4 rol (`admin`, `manager`, `warehouse_staff`, `viewer`) ve RLS policy'leri var. **UI yok.**

**Sayfa:** `/dashboard/settings/permissions`

**Tablo (matrix):**
| Kaynak | viewer | warehouse_staff | manager | admin |
|---|---|---|---|---|
| products.read | ✓ | ✓ | ✓ | ✓ |
| products.create | — | — | ✓ | ✓ |
| products.delete | — | — | — | ✓ |
| inventory.move | — | ✓ | ✓ | ✓ |
| po.approve | — | — | ✓ | ✓ |
| settings.write | — | — | — | ✓ |

**Esneklik:** Default matrix sabit; "custom role" özelliğini Phase 6.2 sonrasına bırak (over-engineering tuzağı).

---

## 6.2 · Davet Akışı

**Şema:**
```sql
CREATE TABLE invitations (
  id UUID PK, company_id UUID, email TEXT, role TEXT,
  invited_by UUID, token TEXT UNIQUE, expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
```

**Akış:**
1. Admin → "Kullanıcı davet et" formu (email + rol + opsiyonel depo)
2. Magic link email (Supabase Auth `signInWithOtp` veya `inviteUserByEmail`)
3. Link tıklanınca → kayıt formu önceden dolu → kabul edince `profiles` oluştur, şirkete bağla

**UI:** `/dashboard/settings/users` — kullanıcı listesi + bekleyen davetler + rol değiştirme + askıya alma.

---

## 6.3 · Depo Bazlı Yetki

**Şema diff:**
```sql
ALTER TABLE profiles ADD COLUMN warehouse_ids UUID[] DEFAULT '{}';
-- boş = tüm depolar (admin/manager default)
```

**RLS güncelleme:** `warehouse_staff` rolü için inventory/movements policy'sine
```sql
USING (warehouse_id = ANY((SELECT warehouse_ids FROM profiles WHERE id = auth.uid())))
```

**UI:** Kullanıcı detayında multi-select depo.

---

## 6.4 · Aktivite Akışı (Activity Feed)

Mevcut `audit_log` üzerine inşa.

**Sayfa:** `/dashboard/activity` + dashboard widget'ı.

**Görünüm:** "Ali stok girişi yaptı — Ürün X, 50 adet — 2dk önce"

**Filtreler:** Kullanıcı, modül, tarih aralığı.

**Realtime:** Supabase Realtime subscribe `audit_log` insert → canlı toast.

---

## 6.5 · Yorum & Notlar

**Şema:**
```sql
CREATE TABLE comments (
  id UUID PK, company_id UUID, entity_type TEXT, entity_id UUID,
  user_id UUID, body TEXT, mentions UUID[],
  parent_id UUID,                     -- thread için
  created_at TIMESTAMPTZ DEFAULT now(), edited_at TIMESTAMPTZ
);
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
```

**Component:** `<CommentThread entityType="product" entityId="..." />`

**Kullanım yerleri:** Ürün, sipariş, sayım, lot detay sayfalarında "Yorumlar" tab.

**@mention:** Yazarken `@` tuşu → kullanıcı dropdown'u (cmdk). Mention'lanan kişiye bildirim (`notifications` insert).

---

## 6.6 · Görev Atama (Lightweight Tasks)

**Şema:**
```sql
CREATE TABLE assignments (
  id UUID PK, company_id UUID, title TEXT, description TEXT,
  entity_type TEXT, entity_id UUID,     -- opsiyonel: bağlı kayıt
  assigned_to UUID, assigned_by UUID,
  due_date DATE, priority TEXT,         -- 'low','med','high'
  status TEXT,                          -- 'open','in_progress','done','cancelled'
  created_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ
);
```

**Kullanım:**
- "Bu sayımı Ali'ye ata"
- "Bu PO'yu manager onaylasın"
- Bağımsız görevler: "Aylık fiziki sayım"

**UI:**
- `/dashboard/tasks` — kendi görevlerim + atadıklarım (kanban veya liste)
- Header'da görev sayacı

---

## 6.7 · Plan & Limit Yönetimi

`companies.subscription_plan` zaten var (`free`, `starter`, `professional`, `enterprise`).

**Limit tablosu (sabit kod, DB değil):**
```ts
// lib/billing/limits.ts
export const PLAN_LIMITS = {
  free:         { users: 1, products: 100,   warehouses: 1, integrations: 0 },
  starter:      { users: 3, products: 1000,  warehouses: 2, integrations: 1 },
  professional: { users: 10, products: 10000, warehouses: 5, integrations: 5 },
  enterprise:   { users: Infinity, ... },
};
```

**Soft enforcement:**
- Limit aşımına yaklaşıldığında banner: "Ürün limitinize %85 ulaştınız — yükselt"
- Limit aşımında yeni ekleme bloklansın, plan yükseltme CTA göster

---

## 6.8 · Şirket-İçi Mesajlaşma (Opsiyonel)

Light bir Slack benzeri kanal — over-engineering riski yüksek, **sadece talep gelirse**. İlk versiyon: "Genel duyuru" tek kanal, dashboard'da görünür.

---

## 6.9 · İki Faktörlü Doğrulama (2FA)

Supabase Auth MFA TOTP desteği var. Aktive et:
- `/dashboard/settings/security` — QR kod + recovery codes
- Admin için zorunlu kılma opsiyonu (`companies.settings.require_2fa_for_admins`)

---

## 6.10 · Oturum Yönetimi

**Sayfa:** `/dashboard/settings/sessions` — aktif oturumlar (cihaz, IP, son aktivite), "tüm cihazlardan çıkış" butonu.

Supabase Auth `auth.sessions` üzerinden listele.

---

# FAZ 7 — Entegrasyonlar

**Amaç:** Veriyi dış sistemlerle senkronlayarak gerçek bir iş aracına dönüşmek. Her entegrasyon **bağımsız bir modül**; müşteri talebine göre sırala.

**Süre:** Modül başına 3–7 gün · **Bağımlılık:** Faz 0, Faz 4 (sipariş şeması)

## 7.1 · Integration Framework (Önce Bu)

Bireysel entegrasyondan önce ortak çatıyı kur — ileride 5 entegrasyon eklemek 5x kolay olur.

**Dosyalar:**
```
apps/web/lib/integrations/
├── core/
│   ├── connector.ts          # abstract Connector sınıfı
│   ├── job.ts                # senkron işi (cron-tetiklenir)
│   ├── webhook.ts            # webhook handler base
│   ├── credentials.ts        # şifreli kimlik yönetimi
│   └── sync-log.ts
└── README.md                 # yeni connector nasıl eklenir
```

**Şema (`013_integrations.sql`):**
```sql
CREATE TABLE integrations (
  id UUID PK, company_id UUID, provider TEXT,      -- 'shopify','trendyol','parasut',...
  name TEXT, credentials JSONB,                    -- encrypted (pgcrypto veya Vault)
  config JSONB, is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ, last_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE sync_logs (
  id UUID PK, integration_id UUID, direction TEXT, -- 'pull','push'
  resource TEXT,                                   -- 'products','orders','inventory'
  records_affected INT, status TEXT, error TEXT,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ
);
CREATE TABLE external_mappings (
  id UUID PK, integration_id UUID, entity_type TEXT,
  internal_id UUID, external_id TEXT,
  UNIQUE(integration_id, entity_type, external_id)
);
```

**Connector arayüzü:**
```ts
abstract class Connector {
  abstract pullProducts(): Promise<SyncResult>;
  abstract pushInventory(items: InventorySnapshot[]): Promise<SyncResult>;
  abstract pullOrders(since: Date): Promise<SyncResult>;
  abstract handleWebhook(payload: unknown, signature: string): Promise<void>;
}
```

**Tetikleyici:** Supabase Edge Function `integration-sync` cron'ı + manual "Şimdi Senkronla" butonu.

---

## 7.2 · Trendyol Entegrasyonu

**API:** Trendyol Seller API (REST, key + secret).

**Senkron:**
- **Pull**: ürünler (mapping ile bizim katalog → Trendyol), siparişler (her 15dk)
- **Push**: stok (her hareket sonrası realtime), fiyat değişiklikleri

**Özellikler:**
- Mağaza birden fazla olabilir → multi-store
- Trendyol siparişi geldiğinde otomatik SO oluştur + stok düşür
- Kargo etiketi PDF download

---

## 7.3 · Hepsiburada Entegrasyonu

Trendyol ile benzer, ayrı connector (`HepsiburadaConnector`). API farkları:
- Listing approval süreci farklı
- Question/Answer endpoint'i var (müşteri soruları) — opsiyonel

---

## 7.4 · Shopify Entegrasyonu

**API:** GraphQL Admin API + REST Webhook + OAuth.

**Akış:** OAuth ile bağla → store URL + access token → senkron başlat.

**Özellikler:**
- Webhook subscribe: `orders/create`, `inventory_levels/update`, `products/update`
- Çift yönlü stok senkron (race condition için "lock" stratejisi)
- Variant desteği (ürün varyasyonları)

---

## 7.5 · Paraşüt / Logo / Bizimhesap (Muhasebe)

**Paraşüt** önce: REST API, OAuth2.

**Senkron yönü:**
- Bizim → Paraşüt: fatura oluştur (PO/SO onaylandığında)
- Paraşüt → bizim: ödeme bilgisi (cari ekstresi)

**UI:** Sipariş detayında "Paraşüt'te faturalandı: ✓ Fatura no XYZ".

**Logo Mikro** ayrı, REST yok, XML/text dosya ile entegrasyon (eski usul) — sadece talep varsa.

---

## 7.6 · E-Fatura / E-Arşiv

Sağlayıcı üzerinden (GİB direkt entegrasyon enterprise iş):
- **Foriba** veya **Mysoft** veya **Logo İşbaşı** API'leri
- Connector tek arayüz: `issueInvoice(invoice)`, `cancelInvoice(uuid)`

**Önemli:** TR muhasebe kuralları — KDV grupları, tevkifat, döviz faturalar.

---

## 7.7 · Kargo Entegrasyonu

**Sağlayıcılar:** Aras, Yurtiçi, MNG, PTT, Sürat.

**Özellikler:**
- Tek arayüz: `createShipment(order, packageInfo): Promise<{ trackingNumber, labelPdf }>`
- Sevkiyat ekranında (Faz 4.4) "Kargo etiketi oluştur" → tek tıkla
- Takip linki müşteriye email ile gönderim

**Alternatif:** **Kolayla / Sevkiyatım** gibi aggregator API → tek entegrasyonla hepsi.

---

## 7.8 · WhatsApp Business API

**Sağlayıcı:** Meta Cloud API veya Twilio.

**Şablon mesajları:**
- Düşük stok uyarısı (manager'a)
- Sipariş onayı (müşteriye)
- Kargo takip linki
- Yaklaşan SKT uyarısı

**Şema:**
```sql
ALTER TABLE notifications ADD COLUMN whatsapp_sent_at TIMESTAMPTZ;
```

**UI:** Settings > WhatsApp — şablon onayları, gönderilen mesaj log'u.

---

## 7.9 · Webhook Sistemi (Outbound)

Kullanıcının kendi sistemine olay yollaması için.

**Şema:**
```sql
CREATE TABLE webhooks (
  id UUID PK, company_id UUID, url TEXT,
  events TEXT[],                       -- ['stock.low','order.created','count.completed']
  secret TEXT,                         -- HMAC için
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
);
CREATE TABLE webhook_deliveries (
  id UUID PK, webhook_id UUID, event TEXT, payload JSONB,
  status_code INT, response TEXT,
  delivered_at TIMESTAMPTZ, attempts INT DEFAULT 0
);
```

**Dispatcher:** Event publish → kuyruğa at → retry (exponential backoff).

**UI:** `/dashboard/settings/webhooks` CRUD + son 100 teslimat log'u.

---

## 7.10 · Public REST API + API Key

**Rota:** `app/api/v1/*` — kendi sunduğun public API.

**Endpointler:**
```
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/inventory
POST   /api/v1/movements
GET    /api/v1/orders
```

**Auth:** `Authorization: Bearer <api_key>` — `api_keys` tablosu.

**Rate limit:** Plan'a göre (Upstash veya in-memory).

**Dokümantasyon:** OpenAPI 3.1 spec → Swagger UI sayfası `/dashboard/api-docs`.

**Bonus:** OpenAPI'den TypeScript client SDK auto-generate (`@hey-api/openapi-ts`).

---

## 7.11 · Zapier / n8n Aktörleri

Public API hazır olunca:
- **Zapier integration**: Triggers (yeni sipariş, düşük stok) + Actions (ürün ekle, stok düzelt)
- **n8n nodes**: kendi n8n custom node paketi

Bu pazarlama açısından büyük bir multiplier.

---

# FAZ 8 — AI / İleri Özellikler

**Amaç:** Klasik stok yazılımından ayrışmak. "Bunu rakip yapamıyor" kategorisi.

**Süre:** Spike + 2 hafta · **Bağımlılık:** Faz 2 (analiz verisi), Faz 7.10 (API)

## 8.1 · AI Altyapısı

**Sağlayıcı seçenekleri:** Anthropic Claude API, OpenAI, Vertex AI. Önerilen başlangıç: **Claude (haiku for fast, sonnet for quality)** — vision yetenekleri + uzun context.

**Dosyalar:**
```
apps/web/lib/ai/
├── client.ts             # Anthropic SDK wrapper
├── prompts.ts            # tüm prompt template'leri
├── tools.ts              # AI'ın çağırabileceği şirket scoped tool'lar
└── rate-limit.ts         # kullanım sınırı (plan'a göre)
```

**Şema:**
```sql
CREATE TABLE ai_usage (
  company_id UUID, user_id UUID, feature TEXT,
  prompt_tokens INT, completion_tokens INT, cost_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Tool calling:** `searchProducts`, `getInventoryStatus`, `getSalesReport` — RLS scope'lu, AI sadece o şirketin verisini görür.

---

## 8.2 · Fatura/İrsaliye OCR (Mal Kabulde)

**Akış:**
1. Mal kabul ekranında "Fatura yükle" → fotoğraf/PDF
2. Vision model çıktıyı parse eder: tedarikçi, fatura no, tarih, satırlar (ürün adı, miktar, fiyat, KDV)
3. Mevcut ürünlerle eşleştirme önerisi (fuzzy match SKU/ad)
4. Kullanıcı onayladıktan sonra otomatik mal kabul form doldurulur

**Prompt yaklaşımı:** Structured output (zod schema → JSON) + few-shot örnekler TR faturalardan.

**Maliyet kontrolü:** Haiku ile ilk pass, belirsizlikte Sonnet.

---

## 8.3 · Görselden Ürün Ekleme

**Akış:** Ürün ekleme formunda fotoğraf yükle → AI önerir: ad, kategori, açıklama, etiketler, varsa barkod (OCR).

**Mobil entegrasyon:** Yeni ürün için kamera ile çek → 3 saniye → ön-doldurulmuş form.

---

## 8.4 · Doğal Dilde Sorgu (NL → SQL/Filter)

**Sayfa:** `/dashboard/ask` veya komut paletine entegre.

**Örnekler:**
- "Geçen ay en çok satan 10 ürün"
- "Stok değeri 50.000₺ üzerinde olan ölü stok ürünleri"
- "Bu hafta hangi tedarikçilerden teslimat bekliyoruz"

**Yaklaşım:**
1. NL → AI tool call (`runReport`, `searchInventory`, vb. read-only tool'lar)
2. AI cevap üretmek yerine **tablo + grafik render etsin** (structured output)
3. Asla raw SQL execute etme — sadece pre-defined tool'lar (SQL injection / RLS bypass riski)

**Maliyet:** Cache benzer sorgular (`query_hash`).

---

## 8.5 · AI Talep Tahmini

Faz 2.5'teki klasik forecast'ın üzerine:
- Kampanya / promosyon dönemlerini hesaba kat
- TR resmi tatil takvimi
- Sezon başlangıçları (ürün kategorisine göre)
- Hava durumu (opsiyonel, mevsimsel ürünler için)

**Yaklaşım:** Önce simple regression / Prophet (Python Edge Function) → ardından LLM ile "yorumla" (explain the forecast).

---

## 8.6 · Anomali Tespiti

**Tetikleyiciler:**
- Olağandışı stok düşüşü (24 saatte normal ortalamanın 3σ üstü)
- Fiyat değişimi (>%20)
- Tek bir kullanıcı tarafından yapılan toplu hareket
- Tekrar eden başarısız okuma (barkod tarayıcı çalışmıyor olabilir)

**Yaklaşım:** Statistical (rolling z-score) + LLM cross-check.

**Çıktı:** Bildirim merkezine düşer + admin'e e-posta.

---

## 8.7 · Akıllı Kategori & Etiket Önerisi

Ürün adı/açıklamadan → kategori, etiket, ölçü birimi önerisi.

Tek-shot LLM çağrısı yeterli; küçük model (Haiku) ile maliyet düşük.

---

## 8.8 · Müşteri Segmentasyonu (RFM)

**RFM skor (klasik, AI gerekmez):**
- Recency: son satın alma tarihi
- Frequency: alım sıklığı
- Monetary: toplam değer

Her boyutta 1-5 skor → segment ("Champion", "Loyal", "At-Risk", "Lost").

**AI katmanı:** Segment başına otomatik pazarlama önerisi metni üret.

---

## 8.9 · "Akıllı Asistan" Chat Widget

Sağ alt köşede chat: kullanıcının sorduğu her şey — sistem dokümanı (RAG) + canlı verisi (tools).

**RAG:**
- StokTakip dokümanı + SSS embed et
- Soru → embedding similarity → relevant chunks → LLM cevap

**Tools:** Faz 8.4'teki gibi okuma araçları. Bonus: izinli kullanıcı için "yeni ürün ekle" gibi yazma araçları (her zaman onay önce göster).

---

## 8.10 · Kampanya / İndirim Önerisi

Ölü stok + yaklaşan SKT için: "Bu 12 ürüne 7 gün süreli %25 indirim öner. Hesap: stok değer kurtarımı 18K₺."

İndirim aktivasyonu Shopify/Trendyol gibi entegrelere push (Faz 7).

---

# FAZ 9 — Performans, Erişilebilirlik, Yayın

**Amaç:** Production-ready. Marketing-ready. Ödeme alır hale gelmek.

**Süre:** 1–2 hafta · **Bağımlılık:** Tüm önceki fazlar (gerektiği kadarı)

## 9.1 · Performans Optimizasyonu

- **Server Component oranı** — Veri çeken sayfaları RSC'ye çevir; sadece interaktif kısımlar `'use client'`
- **Dynamic import** — Recharts, jsPDF, html5-qrcode gibi ağır paketleri `dynamic(() => import(...), { ssr: false })`
- **Image optimization** — Tüm `<img>` → `next/image`; Supabase Storage transform
- **DB index audit** — Slow query log oku → eksik index'leri ekle
- **N+1 query kontrolü** — Her liste sayfasında tek sorgu (`select(..., relations)`)
- **Bundle analyze** — `@next/bundle-analyzer` → 200KB+ paketleri sorgula

**Hedef:** Lighthouse Performance ≥ 90, LCP < 2.5s.

---

## 9.2 · Erişilebilirlik (a11y)

- **axe-core CI** — Playwright + `@axe-core/playwright` her e2e testte
- **Klavye navigasyonu** — Tab order, focus ring her yerde
- **ARIA** — Komponent kütüphanesi (shadcn) zaten iyi; custom widget'ları audit
- **Renk kontrast** — WCAG AA (4.5:1) — dark/light her ikisinde
- **Ekran okuyucu** — NVDA / VoiceOver smoke test
- **Animasyon azaltma** — `prefers-reduced-motion` desteği

---

## 9.3 · i18n Tamamlama

- `messages/en.json` tüm anahtarları içersin (şu an muhtemelen eksikler var)
- Tarih: `date-fns/locale` ile TR/EN
- Sayı: `Intl.NumberFormat`
- Para: `Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY' })`
- Çoğul (pluralization): ICU MessageFormat (`next-intl` destekler)
- Yeni dil eklemek tek bir JSON eklemekle mümkün olsun

---

## 9.4 · Landing & Marketing Sayfaları

**Yapı:**
```
apps/web/app/(marketing)/
├── layout.tsx           # marketing header (dashboard layout'tan ayrı)
├── page.tsx             # landing — hero, features, pricing, FAQ, CTA
├── pricing/page.tsx
├── features/[slug]/page.tsx
├── blog/page.tsx
├── blog/[slug]/page.tsx  # MDX
├── about/page.tsx
└── contact/page.tsx
```

**Legal (zorunlu):**
- `/legal/privacy` — Gizlilik politikası (KVKK uyumlu)
- `/legal/terms` — Kullanım koşulları
- `/legal/kvkk` — Aydınlatma metni
- `/legal/cookies` — Çerez politikası

**SEO:**
- `app/sitemap.ts`
- `app/robots.ts`
- Open Graph + Twitter card meta tags
- Schema.org JSON-LD (Organization, Product, FAQ)

---

## 9.5 · Faturalama (Subscription)

**Sağlayıcı:**
- **iyzico** (TR'de yaygın, 3DS, taksit)
- **Stripe** (uluslararası, daha temiz API)
- İdeal: **iki**si paralel — TR müşteri iyzico, uluslararası Stripe

**Şema (`014_billing.sql`):**
```sql
CREATE TABLE subscriptions (
  id UUID PK, company_id UUID UNIQUE, provider TEXT,
  provider_subscription_id TEXT, plan TEXT, status TEXT,
  current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE invoices (
  id UUID PK, company_id UUID, provider_invoice_id TEXT,
  amount NUMERIC, currency TEXT, status TEXT,
  pdf_url TEXT, paid_at TIMESTAMPTZ
);
```

**Webhook:** Sağlayıcı webhook'larını dinle → `subscriptions` ve `companies.subscription_plan` güncelle.

**UI:** `/dashboard/settings/billing` — mevcut plan, fatura geçmişi, ödeme yöntemi, yükselt/düşür.

**Onboarding tetikleyici:** Trial bitince banner + plan seçim modali.

---

## 9.6 · KVKK Uyum & Veri İhraç

**Veri sahibi hakları:**
- "Tüm verimi dışa aktar" — JSON + Excel zip indir
- "Hesabımı sil" — soft delete + 30 gün bekletme + hard delete cron
- "Düzeltme talep et" — admin'e ticket

**Audit & Saklama:**
- `audit_log` minimum 2 yıl saklanır
- Backup günlük (Supabase otomatik) + haftalık dışa al

---

## 9.7 · İzleme & Uptime

**Servisler:**
- **Sentry** (server + client error tracking)
- **UptimeRobot** veya **BetterStack** — `/api/health` ping
- **Posthog** veya **Plausible** — analytics (GDPR-friendly seç)
- **Vercel Analytics** — Core Web Vitals

**Dashboard:** `/dashboard/admin/system-health` (sadece super-admin) — basit graph + son hatalar.

---

## 9.8 · Lansman Checklist

| Kategori | Madde | ✓ |
|---|---|---|
| Güvenlik | Tüm action'lar `withAuth` | |
| Güvenlik | RLS test edildi (cross-tenant) | |
| Güvenlik | Rate limit (auth + API) | |
| Güvenlik | CSP header | |
| Performans | Lighthouse ≥ 90 | |
| Performans | DB index audit | |
| UX | Mobil tüm sayfalarda test | |
| UX | Dark/light tüm sayfalarda kontrol | |
| Hukuk | KVKK metinleri yayında | |
| Hukuk | Cookie banner | |
| Hukuk | KVK Kurum bildirimi (gerekirse) | |
| Faturalama | İyzico/Stripe canlı modda | |
| Faturalama | Test ödeme + iade testi | |
| Pazarlama | Landing + pricing live | |
| Pazarlama | Email captures çalışıyor | |
| Pazarlama | Sosyal medya hesapları | |
| Destek | Help center / dokümantasyon | |
| Destek | İletişim kanalı (Crisp / Intercom) | |
| Destek | SLA & response time | |

---

# Çapraz Kesişen Konular (5–9 Boyunca)

- **Cache & Revalidate stratejisi** — Server Action sonrası `revalidateTag` ile fine-grained invalidation. Tag taxonomy:
  ```
  company:<id>:products
  company:<id>:inventory
  company:<id>:orders
  ```
- **Realtime kullanımı dengeli** — Sadece dashboard, bildirim, sayım gibi gerçekten anlık yerlerde. Her tabloda değil (Postgres CPU).
- **Feature Flags** — `companies.settings.features` JSONB: yeni özellik beta'ya açıkken belirli müşterilere göster.
- **Telemetri vs gizlilik** — Hiçbir PII Sentry/Posthog'a gönderme; user_id hash'li.

---

# Uzun Vadeli Sprint Önerisi

| Sprint | Faz | Ana Çıktı |
|---|---|---|
| S10 | 5.1–5.4 | Özelleştirilebilir dashboard + Excel import/export |
| S11 | 5.5–5.10 | PDF rapor + kârlılık + zamanlanmış raporlar |
| S12 | 6.1–6.5 | Yetki UI + davet + depo yetki + aktivite + yorum |
| S13 | 6.6–6.10 | Görev + plan limit + 2FA + oturum |
| S14 | 7.1 + 7.2 | Integration framework + Trendyol |
| S15 | 7.3 + 7.5 | Hepsiburada + Paraşüt |
| S16 | 7.7 + 7.9 + 7.10 | Kargo + Webhook + Public API |
| S17 | 8.1 + 8.2 + 8.4 | AI altyapı + OCR + NL sorgu |
| S18 | 8.5 + 8.6 + 8.9 | Forecast + anomali + chat asistan |
| S19 | 9.1 + 9.2 + 9.3 | Perf + a11y + i18n |
| S20 | 9.4 + 9.5 | Landing + faturalama |
| S21 | 9.6 + 9.7 + 9.8 | KVKK + monitoring + launch |

---

# "Beta'dan v1'e" Yol İşaretleri

**Beta yayını (v0.9):** Faz 5 + 6 tamamlandıktan sonra — küçük müşteri grubuna ücretsiz.

**Public launch (v1.0):** Faz 9 tamamlandıktan sonra — fiyatlandırma + marketing aktif.

**v1.5 (3-6 ay sonra):** Faz 7 entegrasyonları (en az 3 önemli) + Faz 8 AI özelliklerinden 2-3 tanesi.

**v2.0 (12 ay sonra):** Tüm fazlar tamam + müşteri geri bildirimiyle iterasyonlar.

---

# Genişleme Senaryoları (Ne Olur Eğer?)

- **Çok-mağaza/zincir mağaza** — `companies` üstüne `organizations` (multi-company aggregation). 50+ mağazalı zincirler için.
- **POS Entegrasyonu** — Mağaza kasası, barkod okut → anlık satış. Faz 4 + Faz 7 hibrit.
- **B2B Marketplace** — Tedarikçinin ürün kataloğu → müşteri direkt sipariş atar. (StokTakip içinde mikro pazaryeri.)
- **Tedarikçi/Müşteri Portalı** — Kendi şifreleriyle giriş, sınırlı görünüm — bilgi paylaşımı.
- **Mobile Native App** — PWA yeterli olmazsa, React Native ile veya Capacitor wrap.

---

*Bu rota canlı bir doküman; piyasa, müşteri ve teknoloji değişimlerine göre çeyrek bazlı revize edilmelidir.*
