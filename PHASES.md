# StokTakip Pro — Faz Detayları (Uygulama Sırası: 0 → 1 → 3 → 2 → 4)

> Her faz bağımsız modüllere bölünmüştür. Bir modül ≈ bir PR. Sıra içinde alt modüller paralel ilerleyebilir; bağımlılıklar belirtildi.

---

# FAZ 0 — Temel Sağlamlaştırma (Foundation)

**Amaç:** Sonraki tüm fazların güvenle hızlı ilerlemesi için altyapıyı sabitlemek. UI'da görünmez, sonraki fazları 2x hızlandırır.

**Süre:** 3–5 gün · **Riski:** Düşük · **Bağımlılık:** —

## 0.1 · Tip & Şema Tutarlılığı

**Sorun:** `lib/types.ts` camelCase, Supabase snake_case. `dashboard/page.tsx` zaten `productName ?? product_name` gibi defansif yazımlar yapıyor.

**Dosyalar:**
```
apps/web/lib/
├── db/
│   └── types.generated.ts    # supabase gen types --linked
├── mappers/
│   ├── product.ts
│   ├── inventory.ts
│   ├── movement.ts
│   ├── order.ts
│   └── index.ts
└── types.ts                  # mevcut, dokunma
```

**Mapper sözleşmesi:**
```ts
// lib/mappers/product.ts
export function toProduct(row: ProductRow): Product { /* snake→camel */ }
export function fromProduct(p: Partial<Product>): Partial<ProductRow> { /* camel→snake */ }
```

**Script:** `package.json` → `"types:gen": "supabase gen types typescript --linked > apps/web/lib/db/types.generated.ts"`

**Kabul:** Hiçbir component artık `x ?? x_alt` defansif okuma yapmıyor. Tüm action'lar dönüşten önce mapper kullanıyor.

---

## 0.2 · Server Action Standardı

**Dosyalar:**
```
apps/web/lib/server/
├── result.ts          # Result<T> tipi
├── with-auth.ts       # HOF: withAuth, withRole, withCompany
├── validate.ts        # zod helper: parseInput<T>(schema, formData|object)
└── errors.ts          # AppError sınıfı + i18n key
```

**Result tipi:**
```ts
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } };
```

**HOF imzaları:**
```ts
withAuth<T>(action: (ctx: AuthCtx, input: I) => Promise<Result<T>>)
withRole<T>(roles: UserRole[], action: ...)
withCompany<T>(action: ...)  // RLS scope için company_id otomatik
```

**Refactor sırası:** `lib/actions/products.ts` → `auth.ts` → `inventory.ts` → `operations.ts` (her biri ayrı PR).

**Kabul:** Tüm action'lar `Result<T>` dönüyor; client tarafta `if (!res.ok)` ile toast otomatik gösteriliyor.

---

## 0.3 · Hata, Loglama, Telemetri

**Dosyalar:**
```
apps/web/lib/log.ts             # info/warn/error, server-side
apps/web/app/dashboard/error.tsx # mevcut → markalı, "rapor et" butonu
apps/web/app/global-error.tsx    # yeni
```

**`lib/log.ts`:**
```ts
export const log = {
  info:  (msg: string, ctx?: Record<string, unknown>) => { /* console + pino-prod */ },
  error: (err: unknown, ctx?: Record<string, unknown>) => { /* + Sentry opsiyonel */ },
};
```

**Client tarafı:** `lib/client/toast.ts` — `notify.error(result)` → otomatik `Result` parse + sonner toast.

**Kabul:** Tüm yakalanmış hatalar tek noktadan akıyor; production'da PII içermiyor.

---

## 0.4 · Test İskeleti

**Bağımlılıklar:** `vitest`, `@testing-library/react`, `@playwright/test`, `msw`.

**Dosyalar:**
```
apps/web/
├── vitest.config.ts
├── playwright.config.ts
├── tests/
│   ├── unit/
│   │   ├── mappers/product.test.ts
│   │   └── actions/products.test.ts
│   └── e2e/
│       ├── auth.spec.ts
│       └── product-create.spec.ts
```

**Smoke senaryosu:** login → ürün oluştur → stok girişi → dashboard'da görünüyor mu.

**Kabul:** `pnpm test` < 30sn; CI hazır.

---

## 0.5 · Yardımcı Sözleşmeler

**Component sözleşmeleri:**
```
apps/web/components/shared/
├── page-header.tsx       # title + actions + breadcrumb
├── empty-state.tsx       # icon + title + desc + cta
├── data-table/           # 1.4'te detay
└── confirm-dialog.tsx
```

**Stil & Layout:**
- `app/dashboard/layout.tsx` üzerinde sticky header + scroll alanı standartlaşsın
- Tüm sayfalar `<PageHeader />` ile başlasın

---

# FAZ 1 — Kullanım Kolaylığı (UX Quick Wins)

**Amaç:** Mevcut kullanıcının "vay" demesi. Yeni hiçbir backend olmadan tamamen frontend çarpan.

**Süre:** 1–2 hafta · **Bağımlılık:** Faz 0

## 1.1 · Komut Paleti (Cmd+K)

**Dosyalar:**
```
apps/web/components/shared/command-palette.tsx
apps/web/lib/commands/registry.ts
```

**Komutlar:**
- Navigasyon: tüm dashboard rotaları
- Aksiyon: "Yeni ürün", "Stok girişi", "Sayım başlat", "Barkod tara"
- Arama: ürün adı/SKU/barkod (server action `searchEverything`)
- Son kullanılan ürünler (localStorage)

**Bağlama:** `app/dashboard/layout.tsx` içinde `useEffect` ile `Cmd/Ctrl+K`.

**Mevcut paket:** `cmdk` zaten var.

---

## 1.2 · Klavye Kısayolları

**Dosya:** `lib/hotkeys.ts` (merkezi tanım) + `hooks/use-hotkey.ts`.

**Kısayollar:**
| Tuş | Aksiyon |
|---|---|
| `/` | Global arama odakla |
| `N` | Yeni (bağlama göre: ürün/sipariş/sayım) |
| `G I` | Envanter |
| `G D` | Dashboard |
| `G P` | Ürünler |
| `Esc` | Modal kapat |
| `?` | Kısayol listesi modali |

**Kabul:** `?` ile açılan modal tüm kısayolları gösteriyor.

---

## 1.3 · Global Arama (Header)

**Dosyalar:**
```
apps/web/components/dashboard/global-search.tsx
apps/web/lib/actions/search.ts
```

**Action:**
```ts
searchEverything(q: string): Promise<{
  products: Product[]; orders: Order[]; customers: Customer[]; suppliers: Supplier[];
}>
```

**Postgres:** `pg_trgm` GIN index (`name`, `sku`, `barcode`). Yeni migration: `004_search_indexes.sql`.

---

## 1.4 · DataTable Sözleşmesi

**Dosyalar:**
```
apps/web/components/shared/data-table/
├── data-table.tsx           # ana component
├── columns.tsx              # kolon tipi & helpers
├── column-visibility.tsx    # göster/gizle dropdown
├── filter-bar.tsx           # filtre çubuğu
├── saved-views.tsx          # preset filtre kaydet/yükle
├── bulk-toolbar.tsx         # toplu işlemler
└── use-table-state.ts       # URL + localStorage sync
```

**Özellikler:**
- Server-side sort/filter/pagination (Supabase `.range()`)
- URL query sync: `?q=...&page=2&sort=name:asc&filter[status]=low`
- `localStorage` ile kolon gizleme, sayfa boyutu hatırla
- Sticky header + virtual scroll (>500 satır için `@tanstack/react-virtual`)

**Refactor:** Ürünler, Stok Hareketleri, Tedarikçi, Müşteri, Depo sayfalarını bu DataTable'a geçir.

---

## 1.5 · Toplu İşlemler (Bulk Actions)

**Toolbar:** Seçim olduğunda alttan slide-up:
- Sil (onaylı), Kategori değiştir, Fiyat güncelle (% / sabit ₺), Aktif/Pasif, Etiket ekle, CSV/Excel dışa aktar.

**Action imzaları:**
```ts
bulkUpdateProducts(ids: string[], patch: Partial<Product>): Promise<Result<{ updated: number }>>
bulkDeleteProducts(ids: string[]): Promise<Result<{ deleted: number }>>
bulkPriceUpdate(ids: string[], op: { type: 'percent' | 'fixed'; value: number }): Promise<Result>
```

---

## 1.6 · Inline Edit

**Component:** `<InlineEditCell />` — çift tıkla ya da `Enter`'da düzenleme moduna girer; `Escape` iptal, `Enter` kaydet (optimistic update + toast).

**Kapsam (1. iterasyon):** Ürün adı, satış fiyatı, min/max stok.

---

## 1.7 · Onboarding Sihirbazı

**Rota:** `/dashboard/onboarding` — yeni şirket ilk girişte zorunlu, sonra atlanabilir.

**Adımlar:**
1. Şirket bilgileri (logo upload)
2. İlk depo (varsayılan: "Ana Depo")
3. Kategoriler (önerilen şablonlar: Gıda, Kozmetik, Elektronik...)
4. İlk 5 ürün (Excel template indir veya manuel)

**`companies.settings.onboarding_completed_at`** ile takip.

---

## 1.8 · Empty States & Boş Durumlar

Her liste sayfasına `<EmptyState />` (illüstrasyon + başlık + açıklama + CTA). Şablon: `components/shared/empty-state.tsx`.

---

## 1.9 · Favoriler & Son Kullanılanlar

**Şema diff (`005_favorites.sql`):**
```sql
CREATE TABLE user_favorites (
  user_id UUID, entity_type TEXT, entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);
```

**UI:** Ürün satırında yıldız ikonu; dashboard'a "Favori Ürünler" widget'ı.

**Son kullanılanlar:** `localStorage` (offline-safe), 10 ürün limit.

---

## 1.10 · Mobil Bottom Sheet & Form Hijyeni

- Mobil <768px: dialog yerine `sheet` (zaten var) tabandan açılır
- `inputmode="numeric"` sayısal alanlarda; `enterKeyHint="search"` arama kutularında
- Klavye açıkken submit butonu görünür kalsın (sticky)

---

# FAZ 3 — Barkod & Mobil Saha Kullanımı

**Amaç:** Depo personeli telefonla işi yapsın. Offline çalışsın. Etiket bassın.

**Süre:** 1–2 hafta · **Bağımlılık:** Faz 1 (DataTable, toast, hotkeys)

## 3.1 · PWA Service Worker İyileştirme

**Mevcut:** `public/sw.js` basit. Yeniden yaz.

**Strateji:**
- Statik asset → CacheFirst
- API/Action → NetworkFirst, fail → IndexedDB queue
- HTML → StaleWhileRevalidate

**Dosyalar:**
```
apps/web/public/sw.js                # rewrite (workbox-sw veya manuel)
apps/web/lib/offline/queue.ts        # IndexedDB (Dexie)
apps/web/lib/offline/sync.ts         # online olunca pop & replay
apps/web/components/shared/offline-indicator.tsx
```

**Kuyruk şeması:**
```ts
type PendingAction = {
  id: string;            // uuid
  action: 'stock_in' | 'stock_out' | 'transfer' | 'count';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
};
```

**UI göstergesi:** Header'da "● 3 bekleyen işlem" rozeti, tıklayınca detay.

---

## 3.2 · Barkod Etiket Yazdırma

**Dosyalar:**
```
apps/web/app/dashboard/products/labels/page.tsx     # toplu etiket sayfası
apps/web/components/labels/label-preview.tsx
apps/web/lib/labels/templates.ts                    # boyut + layout
apps/web/lib/labels/generate-pdf.ts                 # jsPDF + jsbarcode
```

**Şablonlar:**
- 50×30 mm (rulo termal)
- 38×25 mm (rulo termal small)
- A4 sayfa (3×8 = 24 etiket / sayfa)
- Özelleştirilebilir: logo, ürün adı, SKU, barkod, fiyat, SKT

**Akış:** Ürünler sayfasından çoklu seç → "Etiket yazdır" → adet seç → önizleme → PDF indir.

---

## 3.3 · Hızlı Sayım (Cycle Counting)

**Şema (`006_counting.sql`):**
```sql
CREATE TABLE stock_counts (
  id UUID PK, company_id UUID, warehouse_id UUID,
  scope JSONB,        -- { categories: [...], locations: [...] }
  status TEXT,        -- 'open', 'in_progress', 'review', 'closed'
  started_by UUID, started_at TIMESTAMPTZ, closed_at TIMESTAMPTZ
);
CREATE TABLE stock_count_items (
  id UUID PK, count_id UUID, product_id UUID, lot_number TEXT,
  expected_qty NUMERIC, counted_qty NUMERIC, variance NUMERIC,
  scanned_by UUID, scanned_at TIMESTAMPTZ
);
```

**Sayfalar:**
```
/dashboard/counts                  # liste
/dashboard/counts/new              # kampanya oluştur
/dashboard/counts/[id]             # detay
/dashboard/counts/[id]/scan        # mobil sayım ekranı (büyük buton, barkod odaklı)
/dashboard/counts/[id]/review      # fark raporu + onay
```

**Onay aksiyonu:** Tüm farkları tek `adjustment` movement'a çevir, count'u `closed` yap.

---

## 3.4 · Sesli & Titreşim Feedback

**Dosya:** `lib/feedback.ts`
```ts
export const feedback = {
  ok:    () => { beep(800, 80); navigator.vibrate?.(50); },
  warn:  () => { beep(440, 150); navigator.vibrate?.([50, 50, 50]); },
  error: () => { beep(220, 250); navigator.vibrate?.(300); },
};
```

`barcode-scanner.tsx` her okumada (başarılı/başarısız/duplicate) çağırsın.

---

## 3.5 · Lokasyon QR (Raf Bazlı)

**Mevcut:** `warehouse_locations` tablosu var, UI yok.

**Yeni sayfalar:**
```
/dashboard/warehouses/[id]/locations            # lokasyon CRUD
/dashboard/warehouses/[id]/locations/print      # QR etiket bas
/dashboard/scanner?mode=location                # lokasyon QR oku → o raftaki stok
```

**Şema diff (`007_inventory_location.sql`):**
```sql
ALTER TABLE inventory ADD COLUMN location_id UUID REFERENCES warehouse_locations(id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
```

---

## 3.6 · Çoklu Tarama Modu

`/dashboard/scanner` üzerinde toggle:
- **Tekli** (mevcut): okuma → modal aç → onayla
- **Çoklu/Hızlı**: ardışık okuma, sağda canlı liste birikiyor, sonunda "Topla işle" tek action.

Duplicate okumada `feedback.warn` + listede `×N` rozeti.

---

## 3.7 · USB/Bluetooth Barkod Okuyucu

Klavye-emülasyonlu okuyucular zaten input'a yazar. Tek gereken:
- `/dashboard/scanner` ve sayım ekranlarında otomatik gizli `<input autoFocus>` 
- 50ms içinde gelen ardışık keystroke barkod sayılır (insan bu kadar hızlı yazamaz)
- `lib/scan-detector.ts` — bu detection helper'ı

---

## 3.8 · Mobil Navigasyon İyileştirme

**Mevcut:** `components/dashboard/mobile-nav.tsx`.
**Ekle:** Alt FAB (Floating Action) → tarayıcıya direkt git. PWA standalone modda safe-area-inset padding.

---

# FAZ 2 — Akıllı Stok & Otomasyon

**Amaç:** Uygulama asistana dönüşsün. Kullanıcı bakmasa bile sistem ona söylesin.

**Süre:** 1–2 hafta · **Bağımlılık:** Faz 0 (action standardı), Faz 3.3 (sayım verisi opsiyonel)

## 2.1 · Reorder Point & Sipariş Önerisi

**View (`008_views.sql`):**
```sql
CREATE OR REPLACE VIEW v_reorder_suggestions AS
SELECT p.id, p.name, p.sku, p.min_stock,
       SUM(i.quantity) AS current_stock,
       (p.min_stock - SUM(i.quantity)) AS shortage,
       /* tercihli tedarikçi: son alımdaki tedarikçi */
       (SELECT supplier_id FROM purchase_orders po
        JOIN purchase_order_items pi ON pi.order_id = po.id
        WHERE pi.product_id = p.id ORDER BY po.created_at DESC LIMIT 1) AS preferred_supplier_id
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
GROUP BY p.id
HAVING SUM(i.quantity) <= p.min_stock;
```

**Sayfa:** `/dashboard/reorder` — tedarikçi grupla, "Tümünü PO'ya çevir" butonu (tedarikçi başına bir draft PO).

**Action:**
```ts
createDraftPOFromSuggestions(supplierId: string, items: { productId: string; qty: number }[]): Promise<Result<{ orderId: string }>>
```

---

## 2.2 · Stok Devir Hızı (Turnover)

**Hesap:** Son 30/60/90 gün toplam çıkış / ortalama stok.

**View:**
```sql
CREATE VIEW v_inventory_turnover AS
SELECT p.id, p.name, ...
       SUM(CASE WHEN m.movement_type='out' AND m.created_at >= now() - interval '30 days' THEN m.quantity ELSE 0 END) AS out_30d,
       AVG(i.quantity) AS avg_stock,
       /* turnover_30d = out_30d / NULLIF(avg_stock,0) */
FROM products p ...;
```

**UI:** Reports sayfasında "Devir Hızı" tab; yavaş hareket eden ürünler kırmızı.

---

## 2.3 · ABC Analizi

**Pareto:** Cironun %80'ini sağlayan = A, sonraki %15 = B, kalan = C.

**Hesap (server action):**
```ts
runABCAnalysis(period: '30d'|'90d'|'1y'): Promise<{ a: Product[]; b: Product[]; c: Product[]; chartData: ... }>
```

**UI:** Raporlar > ABC Analizi; segmentlere renk + pasta grafiği (recharts).

---

## 2.4 · Ölü Stok Tespiti

**Tanım:** Son N gündür (varsayılan 90) hiçbir `out`/`transfer` hareketi olmamış ama stoğu olan ürünler.

**UI:** `/dashboard/reports/dead-stock` — liste + "indirim kampanyası öner" CTA (Faz 8'de AI bağlanır).

---

## 2.5 · Talep Tahmini (Basit)

**Yöntem:** Hareketli ortalama (son 12 hafta) + mevsimsel düzeltme katsayısı (geçen yıl aynı hafta).

**Dosya:** `lib/forecast/moving-average.ts` (saf TS, test edilebilir).

**UI:** Ürün detayında "Talep Projeksiyonu" grafiği; gelecek 4 hafta tahmin + confidence band.

---

## 2.6 · SKT Kural Motoru

**Şema (`009_skt_rules.sql`):**
```sql
CREATE TABLE expiry_rules (
  id UUID PK, company_id UUID,
  trigger_days INT,                  -- ör. 30, 14, 7
  category_id UUID,                  -- nullable (tüm kategoriler)
  channels TEXT[],                   -- ['in_app', 'email', 'push', 'whatsapp']
  recipients UUID[],                 -- profile ids; boş = tüm admin+manager
  is_active BOOLEAN DEFAULT true
);
```

**Cron:** Supabase Edge Function `daily-expiry-check` günde 1 kez çalışsın → eşleşen lot'ları bul → bildirim/email gönder.

**UI:** `/dashboard/settings/rules/expiry` — kural CRUD.

---

## 2.7 · Akıllı Bildirim Merkezi

**Mevcut:** `notifications` tablosu + `/dashboard/notifications` sayfası.

**Ekle:**
- Bildirim tipi kategorize: `stock_low`, `expiry_soon`, `order_approved`, `count_started`, `system`
- Filtre + okunmuş/okunmamış toggle
- Kullanıcı tercihleri: hangi tipte hangi kanal (`profile.preferences.notifications`)
- Real-time: Supabase Realtime subscribe (header zilinde canlı sayaç)

---

## 2.8 · Audit Trail UI (Zaman Tüneli)

**Mevcut:** `audit_log` tablosu, kayıt giriyor (ya da girmesi gerekiyor).

**Önce:** Tüm mutating action'lar `lib/server/audit.ts` üzerinden `logAudit(...)` çağırsın.

**Sonra:** Ürün/Sipariş/Sayım detay sayfasına "Geçmiş" tab → kim ne zaman ne değiştirdi (diff görünümü).

---

## 2.9 · Dashboard Akıllı Kartlar

Mevcut 4 stat kartına ek olarak (kullanıcı dismiss edebilir):
- "5 ürün önümüzdeki hafta tükeniyor — Sipariş önerisini gör"
- "12 lot SKT'sine 7 gün kaldı — İndirim öner"
- "Ölü stok değeri 24.500₺ — İncele"
- "Bu ay devir hızı geçen aya göre %12 ↓"

---

# FAZ 4 — Sipariş & Operasyon Akışları

**Amaç:** PO/SO iskeletini gerçek operasyon ekranlarına dönüştürmek.

**Süre:** 2 hafta · **Bağımlılık:** Faz 0, Faz 1 (DataTable), Faz 3 (mobil mal kabul opsiyonel)

## 4.1 · Satın Alma — Onay Zinciri

**Durum makinesi:**
```
draft → pending (manager onayına) → approved → received (kısmi/tam)
                                  ↘ rejected
                  ↘ cancelled
```

**Action'lar:**
```ts
submitForApproval(orderId)
approveOrder(orderId)
rejectOrder(orderId, reason)
```

**Yetki:** `manager` ve `admin` onaylar; tutar limiti `companies.settings.po_approval_threshold`.

**UI:** PO detayında durum şeridi (stepper) + audit notları.

---

## 4.2 · Mal Kabul Ekranı

**Sayfa:** `/dashboard/orders/purchase/[id]/receive`

**Özellikler:**
- Sipariş satırlarını listele (sipariş edilen, daha önce alınan, kalan)
- Her satıra: alınan adet, lot no, SKT, hasar/red gerekçesi
- Tek tıkla otomatik `in` movement + inventory upsert
- Kısmi teslim: PO durumu `partial`, kalan kaydı tutar
- Barkod okuyarak hızlı doldurma (Faz 3 entegrasyonu)

**Action:**
```ts
receivePurchaseOrder(id, lines: {
  itemId: string; quantity: number; lotNumber?: string; expiryDate?: string;
  rejected?: number; rejectionReason?: string;
}[]): Promise<Result<{ movementsCreated: number }>>
```

---

## 4.3 · Satış — Pick List (Toplama)

**Sayfa:** `/dashboard/orders/sales/[id]/pick`

**Lokasyon sırasıyla** (warehouse_locations) toplama listesi:
- Her satıra: lokasyon, ürün, adet, "topladım" checkbox
- Barkod okuyarak doğrulama (yanlış ürün okuduysa uyar)
- Tümü toplandığında "Sevkiyata hazır" durumu

**Şema diff:**
```sql
ALTER TABLE sales_orders ADD COLUMN picked_at TIMESTAMPTZ, picked_by UUID;
ALTER TABLE sales_order_items ADD COLUMN picked_qty NUMERIC DEFAULT 0;
```

---

## 4.4 · Sevkiyat (Shipping)

**Sayfa:** `/dashboard/orders/sales/[id]/ship`

**Form:**
- Kargo firması (Aras/Yurtiçi/MNG/Diğer)
- Takip no
- Sevk tarihi
- Belgeler (irsaliye no, fatura no)
- Onayla → otomatik `out` movement + `shipped` durumu + müşteriye e-posta (opsiyonel)

---

## 4.5 · İade (RMA) İş Akışı

**Yeni tablo (`010_returns.sql`):**
```sql
CREATE TABLE returns (
  id UUID PK, company_id UUID, type TEXT CHECK (type IN ('customer', 'supplier')),
  related_order_id UUID,         -- sales/purchase order
  reason TEXT, status TEXT,      -- 'pending','approved','received','rejected'
  created_by UUID, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE return_items (
  id UUID PK, return_id UUID, product_id UUID, lot_number TEXT,
  quantity NUMERIC, condition TEXT,   -- 'resellable','damaged','scrap'
  unit_value NUMERIC
);
```

**Akış:**
- Müşteri iadesi → onay → stok girişi (condition'a göre destination warehouse, "scrap" ise ayrı sanal depo)
- Tedarikçi iadesi → tedarikçiye iade hareketi → kredi notu (opsiyonel)

---

## 4.6 · Fiyat Listeleri

**Şema:**
```sql
CREATE TABLE price_lists (
  id UUID PK, company_id UUID, name TEXT, currency TEXT DEFAULT 'TRY',
  applies_to TEXT,           -- 'all','customer','supplier','tag'
  applies_to_id UUID,        -- nullable
  valid_from DATE, valid_to DATE
);
CREATE TABLE price_list_items (
  id UUID PK, price_list_id UUID, product_id UUID, price NUMERIC, min_qty NUMERIC DEFAULT 1
);
```

**UI:** `/dashboard/price-lists` CRUD + ürün/sipariş ekranlarında otomatik en uygun fiyat seçimi.

---

## 4.7 · Çoklu Para Birimi & KDV

**Şema diff:**
```sql
ALTER TABLE products ADD COLUMN tax_rate NUMERIC DEFAULT 20;
ALTER TABLE purchase_orders ADD COLUMN currency TEXT DEFAULT 'TRY', exchange_rate NUMERIC DEFAULT 1;
ALTER TABLE sales_orders ADD COLUMN currency TEXT DEFAULT 'TRY', exchange_rate NUMERIC DEFAULT 1;
```

**Servis:** `lib/fx.ts` — TCMB veya frankfurter.app'ten günlük kur çek, cache.

**UI:** Sipariş formunda para birimi seçimi; tablolarda her zaman TRY karşılığı da göster.

---

## 4.8 · Sipariş Şablonları

**Sık tekrar eden sipariş setleri için.**

```sql
CREATE TABLE order_templates (
  id UUID PK, company_id UUID, name TEXT, type TEXT, -- 'purchase'/'sales'
  partner_id UUID, items JSONB, created_by UUID, created_at TIMESTAMPTZ
);
```

**UI:** "Şablondan yeni sipariş" — partner ve kalemler önceden dolu açılır.

---

## 4.9 · Sipariş PDF & E-posta

**Dosya:** `lib/pdf/order-pdf.ts` (jsPDF + autotable zaten var).

**Şablon:** Logo, sipariş no, tarih, partner bilgisi, kalemler, KDV, toplam, imza alanı, banka hesabı (settings'ten).

**E-posta:** Supabase Edge Function veya Resend; PDF attachment.

---

## 4.10 · Operasyon Dashboard'u

Yeni rota `/dashboard/operations` — sadece şu anki açık işler:
- Onay bekleyen PO'lar (sayı + kart)
- Toplama bekleyen SO'lar
- Sevkiyat bekleyen SO'lar
- Açık iadeler
- Devam eden sayımlar

Manager için "günlük komuta ekranı".

---

# Çapraz Konular (Tüm Fazlarda)

- **Migration sırası:** `004` → `010` numaralarını sırasıyla kullan; her PR kendi `00X_*.sql`'ini getirsin.
- **RLS:** Her yeni tabloya company_id scope'lu policy.
- **i18n:** Her yeni metin `messages/tr.json` + `messages/en.json`'a girsin; `useTranslations` üstünden okusun.
- **Mobil-first:** Her sayfa 375px'te test edilmeden merge etme.
- **Demo store paritesi:** Yeni action'ların `lib/demo-store.ts` karşılığını da güncelle (demo mod kırılmasın).

---

# Önerilen Sprint Planı (5 sprint × ~1 hafta)

| Sprint | Kapsam |
|---|---|
| S1 | Faz 0 tüm modüller (0.1 → 0.5) |
| S2 | Faz 1.1, 1.2, 1.3, 1.4 (palet + kısayollar + arama + DataTable) |
| S3 | Faz 1.5 → 1.10 (bulk, inline, onboarding, favoriler, mobil) |
| S4 | Faz 3.1 → 3.4 (PWA offline + etiket + sayım + feedback) |
| S5 | Faz 3.5 → 3.8 (lokasyon QR + çoklu tarama + USB + mobil nav) |
| S6 | Faz 2.1 → 2.5 (reorder + turnover + ABC + dead + forecast) |
| S7 | Faz 2.6 → 2.9 (SKT rules + bildirim + audit UI + akıllı kartlar) |
| S8 | Faz 4.1 → 4.4 (onay + mal kabul + pick + ship) |
| S9 | Faz 4.5 → 4.10 (RMA + fiyat listesi + currency + şablon + PDF + ops dashboard) |

---

*Her fazın başlangıcında 30 dakikalık "kick-off" — şema diff'i ve action imzalarını netleştir, sonra paralel ilerle.*
