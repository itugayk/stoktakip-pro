# StokTakip Pro — Geliştirme Yol Haritası

> Modüler, faz faz uygulanabilir geliştirme planı. Her faz bağımsız bir PR/sprint olarak ele alınabilir; sıralama tavsiyedir ama zorunlu değildir.

---

## Mevcut Durum (Özet)

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Auth + Postgres + RLS) · Tailwind 4 · shadcn/ui · next-intl (TR/EN) · next-themes · recharts · jsPDF · html5-qrcode · jsbarcode · PWA (manifest + sw.js).

**Tamamlanmış modüller:** Auth, Dashboard, Ürünler, Kategoriler, Stok Hareketleri, SKT Takibi, Depolar, Tedarikçi/Müşteri, Satın Alma/Satış siparişleri (iskelet), Barkod Tarayıcı, Raporlar, Bildirimler, Ayarlar, çok kiracılı (multi-tenant) şema, audit_log, demo store fallback.

**Mimari notlar:** Server Actions (`lib/actions/*`), Supabase SSR, RLS policy'leri, LAN/Cloudflared tunnel ile telefondan erişim, demo mod.

---

## Faz 0 — Temel Sağlamlaştırma (Foundation)
*Süre tahmini: 3–5 gün · Bağımlılık: yok*

Geri kalan tüm fazlar bunun üzerine kurulacak. UI'a görünmez ama hız ve güveni iki kat artırır.

- **Şema & Tip Tutarlılığı**
  - `lib/types.ts` ile DB şeması arasında snake_case ↔ camelCase mapper'ları (`lib/mappers/*.ts`)
  - `database.types.ts` (Supabase CLI) otomatik regen script'i: `pnpm types:gen`
- **Server Actions Standardı**
  - Ortak `Result<T>` tipi (`{ ok, data, error }`), zod ile input validation katmanı
  - `withAuth(action)` ve `withRole(roles, action)` HOF'ları
- **Hata & Telemetri**
  - `error.tsx` ve `not-found.tsx` markalı sürümleri her segment için
  - Sentry veya basit `lib/log.ts` (server-side) + toast (sonner) ile client error funnel
- **Test İskeleti**
  - Vitest + Testing Library kurulum, kritik 5-10 server action için unit test
  - Playwright smoke (login → ürün ekle → stok girişi)

---

## Faz 1 — Kullanım Kolaylığı (UX Quick Wins)
*Süre tahmini: 1–2 hafta · Bağımlılık: Faz 0*

En çok geri dönüşü en az koda alacağın faz. Demo gösterilerinde "vay" dedirten kısım.

- **Komut Paleti** (Cmd/Ctrl+K) — `cmdk` zaten var; tüm rotaları + son ürünler + hızlı aksiyonlar (yeni ürün, stok girişi, barkod tara).
- **Klavye Kısayolları** — `N`: yeni ürün, `/`: ara, `G+I`: envanter, `G+D`: dashboard. `lib/hotkeys.ts` merkezi yönetim.
- **Global Arama** — header'da kalıcı arama; ürün, SKU, barkod, sipariş no, müşteri tek kutudan.
- **Tablo Deneyimi** (tüm liste sayfalarına)
  - Kolon göster/gizle (kullanıcı bazlı `localStorage` veya `profile.preferences` JSONB)
  - Kaydedilebilir filtreler ("Düşük stok + Gıda kategorisi" gibi preset'ler)
  - Sayfa boyutu hatırlama, sticky header, sıralama yönü
  - Sanal scroll (1000+ satır için `@tanstack/react-virtual`)
- **Toplu İşlemler (Bulk Actions)**
  - Checkbox + toolbar: toplu sil, kategori değiştir, fiyat güncelle (%/₺), aktif/pasif, dışa aktar
- **Inline Edit** — Ürün adı, fiyat, min/max stok hücreye çift tıklayınca yerinde düzenlenebilir.
- **Boş Durumlar & Onboarding**
  - Her sayfa için illüstrasyonlu empty state + "İlk ürününüzü ekleyin" CTA
  - 4 adımlık ilk-kurulum sihirbazı (şirket → depo → kategori → ilk ürün)
- **Skeleton Tutarlılığı** — Tüm sayfalarda aynı tip skeleton component'ler.
- **Son Kullanılanlar / Favoriler** — En sık erişilen 5 ürün dashboard'a kart olarak; profile başına favori ürün yıldızı.
- **Mobil Bottom Sheet** — Mobilde modal yerine sheet (`sheet.tsx` zaten var); form klavyesi ile çakışmasın.

---

## Faz 2 — Akıllı Stok & Otomasyon
*Süre tahmini: 1–2 hafta · Bağımlılık: Faz 0*

Uygulamanın "asistan"a dönüştüğü faz. Kullanıcı bunu kurduktan sonra geri dönmek istemez.

- **Yeniden Sipariş Önerisi (Reorder Point)**
  - `min_stock` altında olan ürünler için tedarikçi bazında otomatik PO taslağı
  - "Önerilen Sipariş" sayfası: tek tıkla onay → taslak satın alma siparişi
- **Stok Devir Hızı (Inventory Turnover)** — Ürün/kategori bazında 30/60/90 gün hız, yavaş hareket eden ürünleri vurgula.
- **ABC Analizi** — Pareto kuralı (A: %80 ciro, B: %15, C: %5). Raporlar sayfasına widget.
- **Ölü Stok Tespiti** — N gündür hiç hareket görmemiş ürünler listesi + kampanya/iade önerisi.
- **Talep Tahmini (Basit)** — Hareketli ortalama + mevsimsellik faktörü (yıllık aynı ay). Recharts ile projeksiyon grafiği.
- **SKT Otomasyon**
  - Kural motoru: "X gün kala kime, hangi kanaldan bildirim" (in-app, email, push, WhatsApp)
  - SKT'ye göre otomatik fiyat indirimi önerisi
- **Akıllı Bildirim Merkezi**
  - `notifications` tablosu zaten var. Kategori bazında filtrelenebilir feed
  - Bildirim tercihleri: hangi olayda hangi kanal
- **Audit Trail UI** — `audit_log` zaten var; "Kim, ne, ne zaman" zaman tüneli (ürün/sipariş detay sayfasında tab).

---

## Faz 3 — Barkod & Mobil Saha Kullanımı
*Süre tahmini: 1–2 hafta · Bağımlılık: Faz 1*

Saha kullanıcısı (depo personeli) için makara. PWA olduğun için bu fazda büyük kazanç var.

- **PWA Tam Offline Mod**
  - Service worker (`sw.js`) işlemleri: cache strategy (NetworkFirst → SWR)
  - IndexedDB (Dexie) ile lokal kuyruk: offline stok hareketleri online olunca senkron
  - Senkron durumu görsel göstergesi (bekleyen N işlem)
- **Barkod Etiket Yazdırma**
  - `jsbarcode` + `jspdf` zaten var; etiket şablonları (50×30, 38×25, A4 sayfası)
  - Toplu yazdırma: seçili ürünler + adet
  - Şirket logosu, fiyat, SKU, son kullanma tarihi opsiyonları
- **Hızlı Sayım (Cycle Counting)**
  - Sayım kampanyası oluştur: depo / kategori / lokasyon seç
  - Mobil: barkod oku → sayım gir → fark raporu otomatik
  - Sayım sonu "Stok düzeltme" hareketleri tek tıkla onaya gider
- **Sesli & Titreşim Feedback** — Barkod okurken `Audio` API + `navigator.vibrate`. Yanlış okumada farklı ton.
- **Lokasyon QR (Raf Bazlı Stok)**
  - `warehouse_locations` tablosu zaten var, UI yok. Her rafa QR bas → mobilde QR okut → o raftaki ürünleri göster, ekle/çıkar
- **Çoklu Tarama Modu** — Sürekli okuma; her okumada satıra eklenir, sonunda toplu giriş.
- **USB / Bluetooth Barkod Okuyucu** — Kamera olmayan cihazlar için klavye-emülasyonlu okuyucu desteği (zaten `input` odaklı çalışır ama UI ipucu).

---

## Faz 4 — Sipariş & Operasyon Akışları
*Süre tahmini: 2 hafta · Bağımlılık: Faz 0*

Mevcut PO/SO sayfaları iskelet halinde — bu fazda gerçek operasyon haline gelir.

- **Satın Alma Akışı**
  - Onay zinciri (draft → pending → approved → received). Rol bazlı onaylama.
  - **Mal Kabul Ekranı**: kısmi teslim, hasarlı/eksik kaydı, otomatik stok girişi + lot/SKT atama
  - Tedarikçi fiyat geçmişi (son N alış fiyatı)
- **Satış Akışı**
  - **Pick List**: sevkiyat için toplama listesi (lokasyon sıralı)
  - Sevkiyat ekranı: kargo no, takip linki, kısmi sevk
  - Sipariş şablonları (sık tekrar eden sipariş seti)
- **Fiyat Listeleri** — Müşteri/tedarikçi bazlı özel fiyatlar; para birimi (TRY/USD/EUR).
- **İade (RMA) İş Akışı** — Müşteri iadesi → stok girişi (yeniden satılabilir / hurda), tedarikçiye iade.
- **Sipariş PDF & E-posta** — Markalı PDF (jsPDF zaten var), tek tıkla müşteriye/tedarikçiye gönder.
- **Çoklu Para Birimi & KDV** — `companies.settings` JSONB'ye varsayılan KDV oranı, ürün bazlı override.

---

## Faz 5 — Raporlama & İçgörü
*Süre tahmini: 1–2 hafta · Bağımlılık: Faz 2*

- **Özelleştirilebilir Dashboard** — Widget kütüphanesi; sürükle-bırak (`@dnd-kit`), kullanıcı bazlı layout.
- **Karşılaştırmalı Raporlar** — Bu ay vs. geçen ay, bu yıl vs. geçen yıl; delta + % değişim.
- **Excel İçe/Dışa Aktarma**
  - Ürün toplu yükleme şablonu (xlsx) + hata raporu indirme
  - Stok bakiyesi, hareket dökümü, müşteri/tedarikçi cari ekstresi xlsx export
  - `xlsx` paketi ile streaming export
- **Markalı PDF Raporlar** — Şirket logosu, dönem, imza alanı; jsPDF autotable şablonu.
- **Kar/Zarar Analizi** — Ürün, kategori, depo bazlı brüt kâr; satış fiyatı − maliyet (FIFO/AVG/LIFO seçeneği).
- **Trend & Mevsimsellik** — Recharts area + brush + zoom; yıllık çakıştırma.
- **Zamanlanmış Raporlar** — Cron tabanlı (Supabase Edge Function veya Vercel Cron); haftalık özet e-postası.
- **Saved Views** — Filtrelenmiş bir rapor "Pano olarak kaydet" → menüde yer alır.

---

## Faz 6 — Çoklu Kullanıcı & İşbirliği
*Süre tahmini: 1–2 hafta · Bağımlılık: Faz 0*

- **Yetki Matrisi UI** — Rol × kaynak (read/create/update/delete/approve) tablosu; admin düzenleyebilir. Backend zaten RLS ile hazır.
- **Aktivite Akışı** — `audit_log` üstünde dashboard widget'ı: "Ali ürün ekledi, Ayşe sayım başlattı..."
- **Yorum & Not** — Ürün, sipariş, sayım kayıtlarına yorum (yeni `comments` tablosu). @mention ile bildirim.
- **Görev Atama** — "Bu sayımı Ali'ye ata", "Bu PO'yu Mehmet onaylasın"; basit task tablosu.
- **Depo Bazlı Yetki** — Kullanıcı sadece atandığı depo(ları) görsün/yönetsin (`profiles.warehouse_ids[]`).
- **Davet Akışı** — Email ile davet, magic link kayıt, otomatik şirket ataması.
- **Kullanım/Plan Limitleri** — Subscription plan'a göre kullanıcı sayısı/ürün sayısı limiti + yumuşak uyarı.

---

## Faz 7 — Entegrasyonlar
*Süre tahmini: faz başına 1 hafta · Bağımlılık: Faz 0, Faz 4*

Müşterinin ihtiyacına göre sırala; her biri bağımsız modül.

- **E-ticaret Senkron**
  - Shopify, Trendyol, Hepsiburada, Pazaryeri ortak abstraction (`lib/integrations/marketplace/*`)
  - Ürün/stok push, sipariş pull; webhook + manual sync
- **Muhasebe** — Paraşüt, Logo Mikro (REST), Bizimhesap; fatura senkron.
- **E-Fatura / E-Arşiv** — GİB entegrasyon sağlayıcısı (Foriba/Mysoft/Logo) abstraction.
- **Kargo** — Aras, Yurtiçi, MNG, PTT; sipariş → kargo etiketi, takip no güncellemesi.
- **WhatsApp Business API** — Düşük stok uyarısı, sipariş onayı; Twilio veya Meta Cloud API.
- **Webhook Sistemi** — Kullanıcı kendi endpoint'ini tanımlasın (stock.low, order.created, vb.). HMAC imzalı.
- **Public REST API** — `/api/v1/*` + API key yönetimi (Supabase service key proxy). OpenAPI spec.
- **Zapier / n8n** — Public API üzerine basit triggers/actions; pazarlama açısından büyük çarpan.

---

## Faz 8 — AI / İleri Özellikler
*Süre tahmini: spike + 2 hafta · Bağımlılık: Faz 2, Faz 5*

Diferansiyasyon fazı. "Klasik stok yazılımı" demekten kaçmak için.

- **Fatura/İrsaliye OCR** — Mal kabulde tedarikçi faturasını fotoğrafla → satırlar otomatik dolsun (Claude / GPT vision).
- **Görselden Ürün Ekleme** — Ürün fotoğrafı → AI ile ad, kategori, varsa barkod önerisi.
- **Doğal Dilde Sorgu** — "Geçen ay en çok satan 10 ürünü göster" → SQL üret → tablo + grafik. (Read-only RLS scoped function call.)
- **AI Talep Tahmini** — Klasik forecast'ın üzerine, kampanya/hava/tatil verisiyle düzeltilmiş tahmin.
- **Anomali Tespiti** — Olağandışı stok düşüşü, fire artışı, ortalama dışı fiyat değişimi → bildirim.
- **Akıllı Kategori/Etiket Önerisi** — Ürün adı/açıklamadan kategori öner.
- **Müşteri Segmentasyonu** — Satış geçmişine göre RFM (Recency-Frequency-Monetary) skoru.

---

## Faz 9 — Performans, Erişilebilirlik, Yayın
*Süre tahmini: 1 hafta · Bağımlılık: Faz 1+*

- **Performans** — Server Component oranını artır, `dynamic(import)` ile ağır widget'ları geç yükle, image optimization, Postgres index revizyonu.
- **A11y** — Klavye navigasyonu, ARIA, kontrast denetimi (axe-core), screen reader testi.
- **i18n Tamamla** — `messages/en.json` boşlukları doldur; tarih/sayı/para formatları locale bazlı.
- **SEO & Marketing Pages** — Landing, fiyatlandırma, blog (MDX), legal sayfalar (KVKK, gizlilik, kullanım koşulları).
- **Faturalama** — Stripe veya iyzico ile abonelik (companies.subscription_plan zaten var).
- **Backup & Audit** — Supabase daily backup, dışa aktarılabilir veri (KVKK uyum).
- **Status Page & Uptime** — Sağlık endpoint'i (`/api/health` zaten var) üstünde UptimeRobot.

---

## Çapraz Kesişen Konular (Cross-Cutting)

Her fazda göz önünde bulundurulacak:

- **Tutarlı Komponent Sözleşmesi** — Tüm liste sayfaları aynı `<DataTable />` ve `<PageHeader />` sözleşmesini kullansın.
- **Erişim Logları** — Hassas işlemler (silme, fiyat değişimi, rol değişimi) audit_log'a girsin.
- **Cache & Revalidate** — Server Action sonrası `revalidatePath`/`revalidateTag` stratejisi standartlaşsın.
- **Mobil Öncelik** — Her yeni özelliği önce 375px viewport'ta test et.

---

## Öneri Sıralama (Pragmatik)

1. **Faz 0** (sağlamlaştırma — zorunlu)
2. **Faz 1** (UX quick wins — kullanıcı hemen sevecek)
3. **Faz 3** (mobil & barkod — saha kullanımı için kritik fark)
4. **Faz 2** (akıllı stok — "asistan" hissi)
5. **Faz 4** (sipariş akışları — gerçek operasyon)
6. **Faz 5** (raporlama)
7. **Faz 6** (multi-user)
8. **Faz 7** (entegrasyonlar — müşteri talep eden bağımsız modüller)
9. **Faz 8** (AI — diferansiyasyon)
10. **Faz 9** (yayın hazırlığı)

---

## "Bonus" Çılgın Fikirler (opsiyonel)

- **Sesli Komut** — "Yeni stok girişi 50 adet ürün-X" (Web Speech API).
- **AR ile Raf Bulma** — Telefon kamerası raf QR'larını gördükçe "burası A-1-3" overlay.
- **Gamification** — Sayım hızı leaderboard'u, "Bu hafta en hızlı sayan: Ali".
- **Tedarikçi Portalı** — Tedarikçiler kendi PO'larını görsün, "Hazırlandı" işaretlesin.
- **Müşteri B2B Portalı** — Bayiler kendi sipariş geçmişini görsün, tekrar sipariş atsın.
- **Print Server Köprüsü** — Termal yazıcıya doğrudan barkod gönderme (local agent).

---

*Bu doküman bir öneridir; öncelikleri kullanım senaryona göre yeniden sıralayabiliriz. Hangi fazdan başlayalım dersen, oradan detay teknik tasarım (komponent ağacı, action imzaları, şema diff) çıkarabilirim.*
