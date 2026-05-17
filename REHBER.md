# StokTakip Pro — Başlangıç Rehberi

> Bu rehber, daha önce stok takibi yapmamış veya yazılımla yeni tanışan biri için yazılmıştır. Adım adım, bol örnekle ilerler.

---

## İçindekiler

- [Stok Takibi Nedir?](#bölüm-1-stok-takibi-nedir-neden-yaparız)
- [Sözlük: Bilmen Gereken Terimler](#bölüm-2-sözlük--bilmen-gereken-terimler)
- [İlk Günün: Sıfırdan Kuruluma](#bölüm-3-ilk-günün-sıfırdan-kuruluma)
- [Günlük İşler: Rolünüze Göre](#bölüm-4-günlük-işler--rolünüze-göre)
- [Senaryolar: "Şimdi Ne Yapacağım?"](#bölüm-5-senaryolar--şimdi-ne-yapacağım)
- [Raporlar: Veriye Dayalı Karar Almak](#bölüm-6-raporlar--veriye-dayalı-karar-almak)
- [İpuçları ve En İyi Uygulamalar](#bölüm-7-ipuçları-ve-en-iyi-uygulamalar)
- [Sorun Giderme](#bölüm-8-sorun-giderme)

---

## Bölüm 1: Stok Takibi Nedir? Neden Yaparız?

### Hayalî bir hikaye

Bir bakkal düşün. 200 farklı ürün satıyor. Sabah dükkanı açtığında soruyor kendine: "Bugün ne sipariş etmeliyim?" Defter çıkarıyor, raflara bakıyor, kafadan tahmin yapıyor. Akşam müşteri "Vitamin C var mı?" diyor — bakıyor, yok. Halbuki **yeterince vardı**, ama deponun arka rafında kalmıştı.

Sonra ay sonu: Geçen ay 50.000₺'lik mal aldım, 70.000₺'lik mal sattım. 20.000₺ kâr etmiş olmalıyım. Ama kasada 12.000₺ var. Geri kalan 8.000₺ nerede? **Bilmiyor.** Çünkü hangi ürünü kaça aldığını, kaça sattığını, ne kadarının fire olduğunu, ne kadarının SKT'si dolduğu için atıldığını **kayıt tutmadan tahmin edemez**.

Stok takibi yazılımının çözdüğü problem budur:

> **"Hangi üründen kaç tane var, nerede, ne zaman geldi, ne zaman gidiyor, ne kadar kazandırıyor, ne zaman bitiyor?" sorularına anlık ve kesin cevap vermek.**

### Stok takibi yapmanın 5 büyük faydası

1. **Stoksuz kalmazsın** — sistem 50 adetin altına inince haber verir, sipariş edeceğini hatırlatır.
2. **Fazla stok bağlamazsın** — sermayeni rafa kilitlemiş olmazsın.
3. **Fire/kaybı yakalarsın** — sayım yaptığında "70 olması gerekirken 65 var" bilgisi düşmeyi gösterir.
4. **SKT'sini geçirmezsin** — özellikle ilaç/gıda/kozmetikte kritik.
5. **Veriyle karar verirsin** — hangi ürün kazandırıyor, hangisi yavaş satıyor — net görünür.

### Bu yazılım kimler için?

- **Eczane, parfümeri, kozmetik mağazası** — SKT takibi kritik
- **Toptancı, distribütör** — çoklu depo + birden fazla müşteri
- **E-ticaret mağazası** — pazaryeri ile senkron stok
- **Restoran/Cafe** — gıda + maliyet hesabı
- **Küçük üretici** — hammadde + ürün stoğu
- **Kırtasiye, hırdavat, tekstil** — çok çeşit, çok hareket
- **Genel olarak**: 50+ ürün çeşidi olan, 2+ kişinin çalıştığı her işletme

---

## Bölüm 2: Sözlük — Bilmen Gereken Terimler

Sektörde sürekli geçen ama yeni başlayanın kafasını karıştıran kelimeler:

### Ürünle ilgili

| Terim | Türkçesi / Açıklaması | Örnek |
|---|---|---|
| **SKU** | Stock Keeping Unit — "Stok Kodu". Sistemde her ürüne verdiğin benzersiz koddur. | `ILC-001` (İlaç-001) |
| **Barkod** | Üründe basılı çubuklu kod. Ürünün uluslararası standart kodu (genelde 13 hane). | `8690000000123` |
| **Birim** | Ürünün ölçü birimi. | Adet, kg, lt, kutu, paket |
| **Min Stok** | Bu seviyenin altına inince uyarı. Yeniden sipariş eşiği. | 20 adet |
| **Max Stok** | Bu seviyenin üstüne çıkmak istemiyorsun. Sermaye bağlama. | 200 adet |
| **Kategori** | Ürünleri gruplamak için. | "Vitaminler", "Temizlik" |

### Lot ve SKT

| Terim | Açıklama | Örnek |
|---|---|---|
| **Lot / Parti No** | Aynı üretim partisinin kimliği. SKT takibi için gerekli. | `LOT-2026-A12` |
| **SKT** | Son Kullanma Tarihi. | 15.06.2026 |
| **FEFO** | First-Expired First-Out — "SKT'si yakın olan önce satılsın". Standart stok yönetim mantığı. | — |

### Depo ve hareket

| Terim | Açıklama |
|---|---|
| **Depo** | Stoğun durduğu fiziksel/sanal yer. Birden fazla depo olabilir (mağaza, ana depo, şube). |
| **Lokasyon** | Depo içindeki spesifik konum (raf, koridor). Örn: `A-1-3` |
| **Hareket (Movement)** | Stoğu değiştiren her olay. Türleri: **Giriş**, **Çıkış**, **Transfer**, **Düzeltme**. |
| **Giriş (In)** | Yeni mal geldi (tedarikçiden, üretimden, iade'den). |
| **Çıkış (Out)** | Mal çıktı (satış, fire, iade'den ötürü). |
| **Transfer** | Bir depodan başka depoya hareket. |
| **Düzeltme (Adjustment)** | Sayım sonrası "kayıt 50 diyordu ama gerçek 47" — kayıtla gerçek arasındaki fark. |
| **Envanter** | Belli bir anda elindeki **tüm stok**. "Envanter sayımı" = sayım. |

### Sipariş türleri

| Terim | Açıklama |
|---|---|
| **PO** | Purchase Order — **Satın Alma Siparişi**. Tedarikçiden mal istiyorsun. |
| **SO** | Sales Order — **Satış Siparişi**. Müşteriye mal satıyorsun. |
| **Draft** | Taslak — daha gönderilmemiş. |
| **Pending** | Onay bekliyor (manager onaylayacak). |
| **Approved** | Onaylı — sipariş işleme alındı. |
| **Received** | Mal teslim alındı (PO için). |
| **Shipped** | Sevkedildi (SO için). |
| **Pick List** | Toplama Listesi — depo personeli müşteriye gidecek ürünleri hangi raftan toplayacak. |
| **RMA** | Return Merchandise Authorization — **İade İş Akışı**. |

### Maliyet ve fiyat

| Terim | Açıklama |
|---|---|
| **Alış Fiyatı** | Senin tedarikçiden aldığın fiyat. |
| **Satış Fiyatı** | Müşteriye sattığın fiyat. |
| **Brüt Kâr** | Satış - Maliyet. (Vergiler hariç.) |
| **Marj** | (Brüt Kâr / Satış) × 100. Yüzdesel kâr. |
| **FIFO** | First-In First-Out — "İlk gelen ilk satılır". Maliyeti eski alış fiyatından hesaplar. |
| **LIFO** | Last-In First-Out — "Son gelen ilk satılır". Maliyeti yeni alıştan hesaplar. |
| **AVG** | Ortalama maliyet. Tüm alımların ortalaması. |
| **KDV** | Katma Değer Vergisi. Türkiye'de genelde %20. |

### Analiz terimleri

| Terim | Açıklama |
|---|---|
| **Devir Hızı (Turnover)** | Bir ürün ayda ortalama kaç kez satılıp yenileniyor? Yüksek = hızlı satılan ürün. |
| **ABC Analizi** | Pareto: cironun %80'ini sağlayan ürünler = **A sınıfı** (en önemli). Sonraki %15 = **B**, kalan = **C**. |
| **Reorder Point** | Yeniden sipariş noktası. Stok bu seviyeye düşünce yeni sipariş ver. |
| **Ölü Stok** | 90+ gündür hiç hareket görmemiş ama stoğu olan ürün. Sermayeyi bağlıyor. |
| **Talep Tahmini** | Geçmiş satış verisinden gelecek talebi tahmin etme. |

### Sistem terimleri

| Terim | Açıklama |
|---|---|
| **PWA** | Progressive Web App. Tarayıcıdan açılan ama mobil uygulama gibi çalışan yazılım. Telefon ana ekranına eklenebilir. |
| **Offline mod** | İnternet kesilse bile çalışma. Yapılan işlemler internet gelince otomatik gönderilir. |
| **RLS** | Row Level Security. Veritabanı seviyesinde güvenlik — A şirketinin verisini B şirketi göremez. |
| **API** | Application Programming Interface. Başka programların seninle konuşmasını sağlayan kapı. |
| **Webhook** | Bir olay olduğunda (stok azaldı vb.) belirtilen URL'e haber göndermek. |

---

## Bölüm 3: İlk Günün — Sıfırdan Kuruluma

### Adım 1: Hesap Aç

Tarayıcıda uygulamayı aç → sağ üstte **"Ücretsiz Dene"** butonu → 3 alan:

- Ad Soyad
- E-posta (giriş yaparken kullanacaksın)
- Şifre (8+ karakter)
- (Opsiyonel) Şirket adı

Kayıt olunca otomatik olarak **kendi şirketin kurulur** ve sen **Admin** olursun.

### Adım 2: Onboarding Sihirbazı (4 adım)

Sistem seni adım adım yönlendirir:

**Adım 1 — Şirket Bilgileri**
> Bunlar sipariş PDF'lerinde, e-faturalarda görünecek
- Şirket adı: "ABC Ticaret Ltd. Şti."
- Vergi numarası: 1234567890
- Telefon, adres

**Adım 2 — İlk Depo**
> En azından bir tane lazım. Sonra çoğaltabilirsin.
- Ad: "Ana Depo" veya "Mağaza 1" gibi
- Adres: deponun fiziksel adresi

**Adım 3 — Kategoriler**
> Ürünlerini gruplamak için. Hazır şablonlar var:
- 🍞 Gıda/Market
- 💊 Eczane/Sağlık
- 📱 Elektronik

Şablon seç → o şablondaki kategoriler otomatik eklenir. Sonra ekleyip silebilirsin.

**Adım 4 — İlk Ürünler**
> Hemen 1-5 ürün ekle veya "Şimdi atla" de.
- Ad, SKU, alış fiyatı, satış fiyatı

Bitti. **Dashboard'a yönlendirilir.**

### Adım 3: Mevcut Stoklarını Sisteme Aktarmak

Bunun **iki yolu** var:

#### A) Excel ile toplu yükleme (çok ürün varsa)

1. Sol menüden **Ürünler** → **"İçe Aktar"** (veya `Cmd+K` yazıp "import")
2. **"Şablon İndir"** → boş Excel dosyası
3. Excel'i aç, ürünlerini doldur:

```
Ürün Adı       | SKU      | Barkod         | Kategori | Birim | Min | Max | Alış  | Satış
Paracetamol    | ILC-001  | 8690000000001  | İlaçlar  | kutu  | 20  | 200 | 12.50 | 18.90
Vitamin C 1000 | VIT-001  | 8690000000002  | Vitamin  | kutu  | 30  | 150 | 45.00 | 69.90
```

4. Dosyayı geri yükle → sistem doğrular → kaç satır geçerli, kaç hata var gösterir
5. Hataları indir, düzelt, tekrar dene
6. **"İçe Aktar"** → işlem tamam

**Faydalı detaylar:**
- SKU kullanılmış → güncellenir
- SKU yeni → eklenir
- Eksik kategori → otomatik oluşturulur
- Negatif sayı, eksik alan → satır atlanır, raporda görünür

#### B) Tek tek ekleme (az ürün varsa)

Ürünler sayfasında sağ üstte **"Yeni Ürün"** → form doldur.

### Adım 4: Stoklarını Sisteme Girmek

Ürünler eklendi ama **stok adedi 0**. Şimdi gerçek miktarları gir:

1. Sol menü → **Stok Hareketleri**
2. **"Giriş"** butonuna bas (yeşil)
3. Form:
   - Ürün: Paracetamol
   - Miktar: 342 (deponda kaç var?)
   - Depo: Ana Depo
   - Lot (varsa): LOT-2026-A12
   - SKT (varsa): 15.10.2026
   - Sebep: "Başlangıç envanteri"

Her ürün için tekrar et. Çok ürün varsa: **barkod okuyucu kullan**.

> 💡 **İpucu**: Sonra düzeltmek istersen yine "Giriş" veya "Çıkış" hareketi yapabilirsin. Silme yok — her şeyin **tarihçesi** kalır.

### Adım 5: Ekibini Davet Et

Tek başına çalışmıyorsan:

1. Sol menü → **Ekip**
2. **"Üye Davet Et"** → e-posta + rol seç:
   - **Admin**: her şey
   - **Manager (Müdür)**: sipariş onayları, raporlar
   - **Depo Personeli**: stok girişi/çıkışı, sayım
   - **Görüntüleyici**: sadece okur, değiştiremez
3. **"Davet Oluştur"** → bir link üretilir
4. Linki kopyala → WhatsApp/e-posta ile gönder
5. Davetli linke tıklayıp giriş yapınca otomatik şirketine eklenir

Davet linki 7 gün geçerli.

### Adım 6: İlk Tedarikçi ve Müşterilerini Ekle

- Sol menü → **Tedarikçiler** → **"Yeni Tedarikçi"** (ad, vergi no, iletişim)
- Sol menü → **Müşteriler** → **"Yeni Müşteri"**

İleride sipariş oluştururken bunlardan seçeceksin.

---

## Bölüm 4: Günlük İşler — Rolünüze Göre

### 👤 Eğer **Yönetici (Patron)** isen

Sabah açılıştaki rutin:

1. **Dashboard'u aç** (`G + D`)
2. **Akıllı Kartlara bak** — sistem ne diyor?
   - "5 ürün önümüzdeki hafta tükeniyor" → tıkla → **Sipariş Önerileri** sayfasına git → tedarikçi başına otomatik draft PO oluştur
   - "12 lot SKT'sine 7 gün kaldı" → tıkla → tedbir al (indirim, iade)
3. **Bildirimleri** kontrol et (üstteki zil)
4. **Operasyon Paneli** (`Cmd+K` → "operasyon")
   - Kaç PO onay bekliyor? (sen onaylayacaksın)
   - Kaç müşteri siparişi toplanmayı bekliyor?

Akşam:
1. **Raporlar → Trend** — bugün ciro ne kadardı?
2. **Raporlar → Kar/Zarar** — bu hafta marj nasıl?
3. **Görevler** — ekibe yarın için ne atayacaksın?

---

### 📦 Eğer **Depo Personeli** isen

Telefonu eline al, uygulamayı aç (PWA olarak ana ekrana eklemişsen direkt uygulama gibi açılır).

**Sabah:**
- Operasyon panelinde **toplama bekleyen siparişler** varsa → tek tek aç → **Pick List**'i izle → raflardan ürünleri **barkod okutarak** topla → onayla

**Mal geldiğinde:**
1. Yönetici bir Satın Alma Siparişi (PO) onayladıysa
2. Sen ilgili PO'nun detayına git → **"Mal Kabul"** linkine bas
3. Sipariş satırlarını göreceksin: ne istemiştik, ne aldık, kalan ne kadar
4. Her satırda:
   - Aldığın miktarı yaz (barkod okutursan otomatik +1)
   - Lot no, SKT varsa gir
   - Hasarlı/eksik varsa "red" miktarı + sebep
5. **"Mal Kabulu Tamamla"** → stok otomatik güncellenir, hareketler kaydedilir

**Müşteri siparişi sevkedildiğinde:**
1. Satış Siparişi sayfasından **"Sevkiyat"** linkine bas
2. Form:
   - Kargo firması (Aras/Yurtiçi/MNG…)
   - Takip numarası
   - İrsaliye/fatura no
3. **"Sevket"** → durum "Shipped" olur, stoktan çıkış otomatik

**Ay sonu Sayım:**
1. Yönetici "sayım kampanyası" başlatır
2. Sen telefonu eline al → **Sayımlar** sayfası → açık sayıma gir
3. Üstteki büyük arama kutusuna barkod okut (her okuma +1 sayar) veya manuel yaz
4. Sistem **beklenen vs sayılan** karşılaştırır → fark varsa satır sarı olur
5. Bütün ürünler sayılınca yöneticiye haber ver

---

### 💼 Eğer **Satış Sorumlusu** isen

Müşteri arıyor: "5 kutu Vitamin C istiyorum."

1. **Cmd+K** → "vitamin c" yaz → ürünü gör → kaç stoğun var?
2. **Müşteriler** → o müşteriyi seç (yoksa ekle)
3. **Satış Siparişi** → **"Yeni Sipariş"** → müşteri, ürünler, adetler
4. **Fiyat Listesi** kuruluysa otomatik o müşteriye özel fiyat çıkar (yoksa varsayılan satış fiyatı)
5. **Onaya gönder** → manager onaylayınca depoya gider

Yönetici uzaktaysa kendin onaylayabilirsin (rolün uygunsa).

---

### 🧮 Eğer **Muhasebeci** isen

Ay sonu:

1. **Ürünler → Dışa Aktar → Excel İndir** → tüm ürün listesi + güncel stok değeri
2. **Raporlar → Kar/Zarar** → tarih aralığı: önceki ay, **Maliyet Yöntemi**: AVG (veya FIFO/LIFO işletme politikana göre)
3. **PDF İndir** → markalı rapor (logo, dönem, imza alanı dahil)
4. **Müşteri/Tedarikçi cari ekstresi** (sistemde aksiyon olarak hazır) → istediğin partner için aylık döküm
5. Zamanlanmış rapor kur → her ayın 1'i Kar/Zarar otomatik e-postana gelsin

---

## Bölüm 5: Senaryolar — "Şimdi Ne Yapacağım?"

Gerçek hayatta sık karşılaşılan durumlar:

### Senaryo 1: Yeni bir ürün geldi — sisteme nasıl ekleyeyim?

1. Sol menü → **Ürünler** → **"Yeni Ürün"**
2. Ad, SKU (zorunlu — eşsiz olmalı, örn: `YENI-001`)
3. Barkod alanında **kamera ikonu** var → tıkla → kutudaki barkodu kameraya tut → otomatik okur
4. Kategori, birim, fiyatlar
5. Kaydet
6. **Sonra**: Stok hareketleri → Giriş → bu yeni ürün → 50 adet → kaydet

### Senaryo 2: Yanlış adet girdim — nasıl düzeltirim?

> ❌ Hareketi silemezsin. Çünkü tarihçe kaybolur, audit log bozulur.

✅ Doğru yöntem:
1. Eğer **giriş fazla yazdıysan** → "Çıkış" hareketi yap (fark kadar), sebep: "Yanlış girilen miktarın iadesi"
2. Eğer **çıkış az yazdıysan** → "Giriş" hareketi yap, sebep: "Düzeltme"

Daha temiz yol: **Sayım yap** → sistem farkı görür, tek `adjustment` hareketi olarak kayıt eder.

### Senaryo 3: Stok bitti — yeniden sipariş vermem lazım

Sistem zaten **otomatik takip ediyor**. Min stok altına düşünce:

1. **Sipariş Önerileri** sayfasına git (`Cmd+K` → "sipariş")
2. Stoğu kritik olan tüm ürünler listede, **önerilen miktar** otomatik hesaplanmış
3. Her satırda:
   - Önerilen miktarı değiştirebilirsin
   - Birim fiyatı düzenle
   - Hangi tedarikçi (son alımdaki otomatik seçili)
4. **"PO Oluştur"** → tedarikçi başına gruplu draft PO'lar oluşur
5. Detayda kontrol et → manager'a onaya gönder
6. Manager onaylar → PO "Approved" olur → tedarikçiye PDF gönder (e-posta veya çıktı)

### Senaryo 4: Müşteri "indirim ver" diyor — fiyat listesi nasıl yaparım?

1. Sol menü → **Fiyat Listeleri** → **"Yeni Liste"**
2. Ad: "Ahmet Bey'e Özel"
3. Kapsam: **Müşteri** → Ahmet Bey'i seç
4. Para birimi: TRY
5. Geçerlilik tarihi (örn: 1 yıl)
6. Listeyi oluştur → içine fiyat kalemleri ekle (hangi üründen ne fiyata)
7. Bu müşteriye yeni satış siparişi açtığında **otomatik bu liste fiyatları gelir**

### Senaryo 5: Müşteri malı geri getirdi (iade)

1. Sol menü → **İadeler** → **"Yeni İade"**
2. Tip: **Müşteri İadesi**
3. Müşteri seç, depo seç
4. Sebep: "Hatalı ürün gönderdik"
5. Kalemler için:
   - Ürün
   - Adet
   - **Durum**:
     - **Satılabilir** → tekrar stoğa girer
     - **Hasarlı** → ayrı stok (indirimli satılabilir)
     - **Hurda** → stoğa eklenmez, sadece kayıt için
   - Lot no (orijinal satıştaki neyse)
6. Onaya gönder → onaylanınca → **"Teslim Al"** → stok otomatik artar (scrap hariç)

### Senaryo 6: SKT yaklaşan ürünleri nasıl tespit ederim?

İki yol:

**A) Pasif** (kendin bakarsın)
- Sol menü → **Stok → SKT Takibi** → 3 grup: süresi geçmiş, 30 gün içinde, güvenli

**B) Aktif** (sistem sana söyler)
- Sol menü → **Ayarlar → SKT Kuralları** → **"Yeni Kural"**:
  - Ad: "30 gün uyarı"
  - Gün: 30
  - Kategori: (boş = tümü, veya sadece "İlaçlar")
  - Kanallar: ✅ Uygulama içi ✅ E-posta
  - Aktif ✅
- Her gün otomatik çalışır → 30 güne giren lotlar için bildirim gönderir

### Senaryo 7: Ay sonu sayım yapacağım

1. **Sayımlar** → **"Yeni Sayım"**
2. Depo seç, ad ver: "Mart 2026 Tam Sayım"
3. Kapsam: (boş = tüm ürünler) veya belirli kategoriler
4. **"Başlat"** → sistem o anki stok kayıtlarını "beklenen miktar" olarak alır
5. Telefonu eline al, sayıma git → her ürünü barkodla okuta okuta say
6. Tabloda **Fark** kolonu otomatik hesaplanır
7. Bütün ürünler sayılınca **"Sayımı Onayla"** → fark olan ürünler için otomatik düzeltme hareketleri oluşur

### Senaryo 8: Şubemize transfer yapacağım

1. **Stok Hareketleri** → **"Transfer"** butonu
2. Form:
   - Ürün
   - Miktar
   - Kaynak Depo: Ana Depo
   - Hedef Depo: Şube 1
3. Onayla → Ana Depo'dan çıkış, Şube 1'e giriş otomatik

### Senaryo 9: Yeni çalışan başladı

1. **Ekip** → **"Üye Davet Et"**
2. E-posta: alibey@firma.com
3. Rol: **Depo Personeli** (sadece stok hareketi + sayım yapsın)
4. (Opsiyonel) Depo erişimi: sadece "Ana Depo" → diğer depoları görmez
5. **"Davet Oluştur"** → çıkan linki Ali'ye gönder
6. Ali linke tıklar, kayıt olur, otomatik şirketine girer

### Senaryo 10: Birden fazla cihazda kullanmak

- Uygulama **çoklu cihaz**'ı destekler.
- Aynı hesapla bilgisayar + telefon + tablet → her yerden aynı anda kullan.
- Bir cihazdan ekleme yaparken diğer cihazda **anlık** görünür (bildirim sayacı bile canlı güncellenir).

---

## Bölüm 6: Raporlar — Veriye Dayalı Karar Almak

Sol menü → **Raporlar**. Hangi rapor neyi söyler:

### 📊 Genel Stok Raporu (Reports ana sayfa)
- Toplam stok değeri
- Maliyet değeri
- Potansiyel kâr
- Grafikler (kategori bazlı dağılım)

**Kime hitap eder:** Yönetici, muhasebeci

### 🔄 Devir Hızı (Turnover)
> "Hangi ürün ne kadar hızlı satıyor?"

- **Çıkış 30g / Ortalama Stok** = devir hızı
- 🟢 **Hızlı** (>1.5): çok satıyor, sermayen verimli dönüyor
- ⚪ **Normal** (0.2–1.5)
- 🔴 **Yavaş** (<0.2): durgun, sermaye bağlıyor

**Kime hitap eder:** Yönetici. Yavaş ürünlerle ne yapacağına karar verir (indirim, iade, çekme).

### 🎯 ABC Analizi
> "Cironun %80'i hangi ürünlerden geliyor?"

- **A sınıfı**: cironun %80'ini sağlayan azınlık. **Bu ürünleri asla stoksuz bırakma**.
- **B sınıfı**: %15. Önemli ama A kadar değil.
- **C sınıfı**: kalan %5. Sıkı takip etmeye değmez.

Pasta grafik gösterir.

**Kime hitap eder:** Yönetici. Önceliklendirme: A'ya en çok ilgi, C'yi sadeleştir.

### 💀 Ölü Stok
> "Hangi ürünler raflarımda boş yere duruyor?"

- 90 gündür hareket görmemiş ama stoğu olan ürünler
- Toplam bağlı sermaye değeri görünür
- Eşik özelleştirilebilir (30/60/90/180/365 gün)

**Kime hitap eder:** Yönetici. Aksiyonlar: indirim kampanyası, tedarikçiye iade, hediye verme.

### 💰 Kar/Zarar
> "Hangi ürün gerçekten kazandırıyor?"

- Ürün bazlı: satılan adet × satış fiyatı = Ciro; maliyet × adet = COGS; Brüt Kâr = Ciro - COGS
- Maliyet yöntemi: **AVG** (basit, çoğu işletmeye uygun), **FIFO** (vergi avantajı), **LIFO** (enflasyonda)
- Marj % gösterilir
- PDF olarak indirilebilir (markalı)

**Kime hitap eder:** Muhasebeci, yönetici.

### 📈 Trend & Karşılaştırma
> "Bu ay geçen aya göre nasıl gidiyoruz?"

- Günlük ciro/adet grafiği (90 gün)
- Bu ay vs geçen ay yüzde değişim (4 metrik: ciro, maliyet, sipariş, adet)
- Grafik üzerinde zoom yapılabilir (Brush)

**Kime hitap eder:** Yönetici, raporlama.

### ⏰ Zamanlanmış Raporlar
> "Her hafta pazartesi 09:00'da haftalık özet e-postama gelsin"

1. Sol menü → **Ayarlar → Zamanlanmış Raporlar**
2. Yeni zamanlama:
   - Ad: "Haftalık Özet"
   - Rapor: Stok Bakiyesi
   - Sıklık: Haftalık, Pazartesi, 09:00
   - Alıcılar: patron@firma.com, ahmet@firma.com
3. Aktif ✅
4. Sistem her hafta o saat otomatik PDF + Excel hazırlayıp e-postaya atar

---

## Bölüm 7: İpuçları ve En İyi Uygulamalar

### ⌨️ Hızlandırıcılar

1. **Cmd+K (Mac) / Ctrl+K (Windows)** — her yerden arama paleti. Asla unutma.
2. **/** — üstteki arama kutusuna odakla
3. **?** — kısayol listesi
4. **G + D/P/I/S** — sayfa kısayolları (önce G'ye bas, sonra harfe)
5. Mobilde **sağ alttaki barkod butonu** her sayfada görünür

### 📋 SKU Verme Konvansiyonu

Tutarlı bir sistem kur:
- **Kategori-NumaraSayısı** → `ILC-001`, `ILC-002` (İlaçlar)
- **3 Harf + 3 Sayı** → `PCT-500` (Paracetamol 500mg)
- **Tedarikçi-Ürün** → `ABC-XYZ-001` (ABC tedarikçisinden XYZ ürünü)

Sonradan değiştirmek zor — başta düşün.

### 📦 Min/Max Stok Belirleme

Pratik formül:
- **Min Stok** = (Günlük ortalama satış) × (tedarikçinin teslim süresi gün) × 1.5 (güvenlik payı)
  - Örnek: günde 5 adet satıyorsun, tedarikçi 3 günde getiriyor → Min = 5 × 3 × 1.5 = **22 adet**
- **Max Stok** = Min Stok × 3 (veya 1 aylık satış)
  - 22 × 3 = **66 adet**

İlk başta tahmin yap, 1-2 ay sonra **Devir Hızı** raporuna bakıp ayarla.

### 🏷️ Lot Numarası Kullanımı

- **İlaç, gıda, kozmetik**: kesinlikle lot ekle. SKT takibi olmadan iş yapamazsın.
- **Elektronik, kırtasiye**: lot opsiyonel. Garanti takibi yapacaksan ekle.
- **Format**: `LOT-YYYY-XXX` (yıl + sıra no) veya tedarikçi lot'unu olduğu gibi gir.

### 💾 Yedekleme — Korkma

Verilerin **otomatik olarak Supabase'de** tutulur. Ek olarak:
- **Ayarlar → Verilerim** → her zaman tüm verini Excel olarak indirebilirsin (KVKK m.11 hakkın)
- Önemli kararlar öncesi (büyük güncelleme, ay sonu) bir yedek al

### 🔒 Güvenlik

- **Şifreni paylaşma.** Yeni çalışan = yeni hesap (davet et).
- **Admin hesabını sadece patron(lar) kullansın.** Manager rolü çoğu iş için yeter.
- **2FA** (ileride) açıkken bağlan.
- Şüpheli aktivite görürsen **Audit Log**'tan kim ne yaptı bakabilirsin.

### 🚀 Performans

- **1000+ ürün** sorunsuz çalışır.
- 10.000+ ürün → ekstra performans gerekebilir (DB optimization migration 017 ile yapılmış).
- Mobilde **PWA** olarak ana ekrana ekle → daha hızlı açılır.

### ✅ Sık Yapılan Hatalar

| Hata | Düzeltme |
|---|---|
| "Çıkış hareketi yaptım stok negatif oldu" | Sayım yap, gerçek miktarı bul, düzeltme hareketi gir. |
| "Ürünü silmeye çalışıyorum, silinmiyor" | Üzerinde hareket olan ürün silinemez. Onun yerine **Pasifleştir**. |
| "Aynı barkod farklı ürüne tanımlandı" | Barkod **uniq** olmalı. Sistem uyarır. Düzelt. |
| "Yanlış kategoriye attım" | Inline edit ile düzelt (çift tık), veya toplu seçip "Kategori değiştir" |
| "PO oluşturdum ama gönderemiyorum" | "Pending" durumunda manager onayı bekliyor. Manager'a haber ver. |

### 📱 Mobil Kullanım İpuçları

1. **Ana ekrana ekle** (PWA): Safari/Chrome'da "Paylaş" → "Ana Ekrana Ekle"
2. **Barkod kamerası** HTTPS gerektirir. LAN'dan (`http://192.168...`) açtıysan kamera çalışmaz.
3. **Çoklu tarama modunda** ardışık tara, sonunda toplu işle.
4. **Offline mod**: internet kesilince paniğe kapılma — yapacağın işlemler kuyruğa alınır, internet gelince otomatik gider.

---

## Bölüm 8: Sorun Giderme

### "İnternet kesildi, ne yapacağım?"

Sakin ol:
- Sayfayı tazeleme.
- Stok girişi/çıkışı yapabilirsin — sistem yerelde tutar.
- Sağ üstte **"Bekleyen X işlem"** rozeti çıkar.
- İnternet gelince otomatik gönderilir.
- Eğer manuel test etmek istersen rozete tıkla → **"Şimdi gönder"**.

### "Yanlış şirket adı girmişim"

- Sol menü → **Ayarlar** → şirket bilgileri (henüz UI tam değil, ihtiyaca göre eklenir).
- Şimdilik: Supabase admin'e başvur.

### "Yeni çalışana davet linki gitmedi"

- Sistem otomatik e-posta göndermiyor (gelecek özellik).
- Davet **linki** üretir → onu **WhatsApp / e-posta ile manuel gönder**.
- Linki yeniden kopyalamak için: **Ekip → Bekleyen Davetler** → kopyala butonu

### "Aynı anda iki kişi aynı sipariş üzerinde çalışıyor"

- Sistem **son kaydedeni kazanır** mantığıyla çalışır (last-write-wins).
- Önemli kararlarda **yorum yaz** veya **görev ata** ile koordine ol.
- **Audit log**'tan kim ne yapmış geriye dönük bakabilirsin.

### "Yanlışlıkla ürünü sildim"

- Soft-delete yok. Ürün silindiyse kayıt da gider.
- Eğer **hareket varsa** silinemez zaten (sistem engeller).
- En son çare: **Veri yedeği**'nden geri yükle (sen indirip sakladıysan).

### "Raporlar açılmıyor / yavaş"

- Çok büyük tarih aralığı seçmiş olabilirsin.
- Ürün sayısı 10.000+ ise filtre kullan (kategori, vb.).
- Cmd+K → "trend" gibi sayfayı yeniden açmayı dene.

### "Stripe ödemesi çalışmıyor / Ücretli plana geçemiyorum"

- Stripe entegrasyonu **opsiyonel**'dir, env değişkenleri gerektirir.
- Şu an aktive edilmediyse pay sayfası "stripe yapılandırılmadı" mesajı verir.
- Yöneticinle veya satış ekibimizle iletişime geç.

### "Entegrasyon (Shopify, Trendyol, Paraşüt) çalışmıyor"

- Bu entegrasyonlar şu anda **stub** durumda. UI hazır, kontrat hazır ama gerçek API çağrısı yapılmıyor.
- Aktive etmek için her sağlayıcının özel kimlik bilgisi + bağlantı kontratı gerekli — gelecek sürümlerde aktive olacak.

### "Veri kaybı yaşadım, ne yapabilirim?"

1. **Audit Log**'dan kim ne sildi bul (Ayarlar → Yetki Matrisi sayfasından erişim).
2. Kendi indirdiğin **Excel yedeği** varsa oradan geri al.
3. Supabase'in günlük yedekleri vardır — destek ekibiyle iletişime geç.

---

## Bölüm 9: Sonraki Adımlar

Bu kılavuzu okuyup şirketine kurdun. Şimdi:

### İlk hafta
- [ ] Tüm ürünleri sisteme ekle (Excel ile toplu)
- [ ] Stok adetlerini gir (Stok Hareketleri → Giriş)
- [ ] Tedarikçi ve müşteri listesini ekle
- [ ] Ekibi davet et
- [ ] Min/Max stokları yaklaşık olarak belirle

### İlk ay
- [ ] Günlük operasyonu uygulamadan yap (kağıt-kalem bırak)
- [ ] Bir sayım yap → kayıtla gerçek farkını gör → düzelt
- [ ] SKT kuralı oluştur (varsa SKT'li ürün)
- [ ] Sipariş Önerisi'ne bak, ilk PO'yu sistemden oluştur

### İlk çeyrek
- [ ] **Devir Hızı** raporuna bak → yavaş ürünler için karar al
- [ ] **ABC Analizi** çalıştır → A ürünlerine odaklan
- [ ] **Kar/Zarar** raporu → düşük marjlı ürünleri tespit et
- [ ] Min/Max stokları gerçek verilere göre yeniden ayarla
- [ ] Zamanlanmış rapor kur (haftalık özet)

### İlk yıl
- [ ] Entegrasyon ihtiyaçlarını planla (Shopify, muhasebe vb.)
- [ ] Yetki matrisini gözden geçir, rolleri optimize et
- [ ] Backup stratejisi oluştur (aylık Excel export)
- [ ] Fiyat listelerini etkin kullan (toptan/perakende farkı)

---

## 📞 Yardım

- **Uygulama içinde**: `Cmd+K` → "yardım" / `?` tuşu → kısayollar
- **Hata oluşursa**: Hata ekranındaki "Rapor Et" butonu → bize gönder
- **KVKK / veri**: Ayarlar → Verilerim → her zaman verini indir/sil

İyi kullanımlar 🚀

---

*Bu rehber StokTakip Pro v1.0 için yazılmıştır. Son güncelleme: 2026-05-15*
