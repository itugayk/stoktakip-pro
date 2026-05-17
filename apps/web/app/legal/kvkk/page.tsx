export const metadata = {
  title: "KVKK Aydınlatma Metni — StokTakip Pro",
};

export default function KvkkPage() {
  return (
    <>
      <h1>KVKK Aydınlatma Metni</h1>
      <p className="text-sm">Son güncelleme: 15 Mayıs 2026</p>

      <h2>1. Veri Sorumlusu</h2>
      <p>
        StokTakip Pro hizmetinin veri sorumlusu <strong>StokTakip Yazılım A.Ş.</strong>'dir
        (&ldquo;Şirket&rdquo;). İletişim: <a href="mailto:kvkk@stoktakip.app">kvkk@stoktakip.app</a>
      </p>

      <h2>2. İşlenen Kişisel Veriler</h2>
      <ul>
        <li><strong>Kimlik:</strong> ad, soyad</li>
        <li><strong>İletişim:</strong> e-posta, telefon</li>
        <li><strong>Müşteri/Tedarikçi Bilgileri:</strong> sisteme yüklediğiniz partner verileri</li>
        <li><strong>İşlem güvenliği:</strong> IP, kullanım zamanları, audit log</li>
        <li><strong>Finans:</strong> abonelik durumu (ödeme verilerini biz değil, ödeme sağlayıcısı saklar)</li>
      </ul>

      <h2>3. İşleme Amaçları</h2>
      <ul>
        <li>Hizmetin sunulması ve hesap yönetimi (KVKK m.5/2/c)</li>
        <li>Sözleşmenin kurulması ve ifası (KVKK m.5/2/c)</li>
        <li>Hukuki yükümlülüklerin yerine getirilmesi (KVKK m.5/2/ç) — vergi, denetim</li>
        <li>Meşru menfaatlere dayalı olarak güvenlik (KVKK m.5/2/f) — audit log, anomali tespiti</li>
        <li>Açık rıza ile pazarlama iletişimi (talep ederseniz)</li>
      </ul>

      <h2>4. Aktarım</h2>
      <p>
        Verileriniz:
      </p>
      <ul>
        <li>Yurt içinde Türkiye'de bulunan veri merkezlerinde tutulur (Supabase Avrupa bölgesi).</li>
        <li>Yetkili kamu kurumlarına yasal zorunluluk halinde aktarılır.</li>
        <li>Sizin bağladığınız entegrasyon sağlayıcılarına (Shopify vb.) sadece sizin başlattığınız işlemler için iletilir.</li>
        <li>Reklam veya pazarlama amacıyla üçüncü taraflara <strong>aktarılmaz</strong>.</li>
      </ul>

      <h2>5. Saklama Süresi</h2>
      <ul>
        <li>Hesap aktifken: süresiz.</li>
        <li>Hesap silindikten sonra: operasyonel veriler 30 gün, audit log 10 yıl (vergi mevzuatı).</li>
        <li>Yedekler: 90 gün rotasyonla.</li>
      </ul>

      <h2>6. Haklarınız (KVKK m.11)</h2>
      <p>Aşağıdaki haklara sahipsiniz:</p>
      <ul>
        <li>Kişisel verinizin işlenip işlenmediğini öğrenme</li>
        <li>İşlenen veriler hakkında bilgi talep etme</li>
        <li>Verinizin amaca uygun kullanılıp kullanılmadığını öğrenme</li>
        <li>Yurt içinde aktarılan üçüncü kişileri bilme</li>
        <li>Eksik/yanlış verinin düzeltilmesini isteme</li>
        <li>Silinmesini veya yok edilmesini isteme (Ayarlar → Verilerim sayfasından)</li>
        <li>Verinin işlenmesine itiraz etme</li>
        <li>Kanuna aykırı işleme sonucu zararın giderilmesini talep etme</li>
      </ul>

      <h2>7. Başvuru</h2>
      <p>
        Yukarıdaki haklarınızı kullanmak için <a href="mailto:kvkk@stoktakip.app">kvkk@stoktakip.app</a>{" "}
        adresine başvurabilirsiniz. Başvurunuz 30 gün içinde sonuçlandırılır.
      </p>
      <p>
        Veriniz üzerinde tam kontrol için kendiniz: <strong>Ayarlar → Verilerim</strong> sayfasından
        tüm verinizi xlsx olarak indirebilir, hesabınızı silebilirsiniz.
      </p>
    </>
  );
}
