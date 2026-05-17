export const metadata = {
  title: "Gizlilik Politikası — StokTakip Pro",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Gizlilik Politikası</h1>
      <p className="text-sm">Son güncelleme: 15 Mayıs 2026</p>

      <h2>1. Topladığımız Veriler</h2>
      <p>
        StokTakip Pro kullanırken aşağıdaki verileri toplarız:
      </p>
      <ul>
        <li><strong>Hesap verileri:</strong> ad soyad, e-posta, şifre (bcrypt ile hashed), şirket bilgileri.</li>
        <li><strong>Operasyonel veriler:</strong> Yüklediğiniz ürünler, stok hareketleri, siparişler, müşteri/tedarikçi bilgileri.</li>
        <li><strong>Teknik veriler:</strong> IP adresi, tarayıcı tipi, kullanım zamanı (audit log için).</li>
        <li><strong>Çerezler:</strong> Oturum yönetimi için zorunlu çerezler. Analitik çerez kullanmıyoruz.</li>
      </ul>

      <h2>2. Verileri Nasıl Kullanırız</h2>
      <ul>
        <li>Hizmeti sağlamak ve hesabınızı yönetmek için.</li>
        <li>Güvenlik için (kötüye kullanım tespiti, denetim izleri).</li>
        <li>Talep ettiğinizde teknik destek vermek için.</li>
        <li>Yasal yükümlülükler gerektirdiğinde (mahkeme kararı, vergi denetimi).</li>
      </ul>

      <h2>3. Verilerinizi Kimlerle Paylaşırız</h2>
      <p>
        <strong>Operatör olarak biz hiçbir veriyi üçüncü taraflara satmayız.</strong> Aşağıdaki durumlarda
        paylaşım yapılabilir:
      </p>
      <ul>
        <li><strong>Altyapı sağlayıcıları:</strong> Supabase (veritabanı + auth), Vercel (hosting). Bu sağlayıcılar bizim talimatımız dışında verilerinize erişmez.</li>
        <li><strong>Kendi seçtiğiniz entegrasyonlar:</strong> Shopify, Paraşüt vb. bağladığınız sağlayıcılarla — sadece sizin başlattığınız akışlarda.</li>
        <li><strong>Yasal talepler:</strong> Türkiye'deki yasalar gereği yetkili merciye.</li>
      </ul>

      <h2>4. Verilerinizin Saklanma Süresi</h2>
      <p>
        Hesabınız aktifken tüm verileri saklarız. Hesap silindiğinde:
      </p>
      <ul>
        <li>Operasyonel veriler 30 gün içinde tamamen silinir (geri yüklenebilir grace period).</li>
        <li>Audit logları yasal gereklilik nedeniyle 10 yıl saklanır (vergi mevzuatı).</li>
        <li>Yedekler 90 gün içinde rotasyonla silinir.</li>
      </ul>

      <h2>5. Haklarınız</h2>
      <p>KVKK gereği şu haklara sahipsiniz:</p>
      <ul>
        <li><strong>Veri indirme:</strong> Tüm verilerinizi xlsx formatında indirin (Ayarlar → Verilerim).</li>
        <li><strong>Düzeltme:</strong> Yanlış veriyi UI üzerinden düzeltin.</li>
        <li><strong>Silme:</strong> Hesabınızı kapatın — 30 günde tüm veri silinir.</li>
        <li><strong>İtiraz:</strong> İşlemenize itiraz edebilirsiniz; hesabınız o noktada kapatılır.</li>
      </ul>

      <h2>6. İletişim</h2>
      <p>
        Sorularınız için: <a href="mailto:privacy@stoktakip.app">privacy@stoktakip.app</a>
      </p>
    </>
  );
}
