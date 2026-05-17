export const metadata = {
  title: "Kullanım Şartları — StokTakip Pro",
};

export default function TermsPage() {
  return (
    <>
      <h1>Kullanım Şartları</h1>
      <p className="text-sm">Son güncelleme: 15 Mayıs 2026</p>

      <h2>1. Sözleşmenin Kabulü</h2>
      <p>
        StokTakip Pro'yu (&ldquo;Hizmet&rdquo;) kullanarak bu kullanım şartlarını kabul etmiş olursunuz.
        Kabul etmiyorsanız hizmeti kullanmayın.
      </p>

      <h2>2. Hesap</h2>
      <ul>
        <li>Hesap açarken gerçek bilgi vermelisiniz.</li>
        <li>Şifrenizi gizli tutmaktan siz sorumlusunuz.</li>
        <li>Hesabınızdan gerçekleşen tüm aktiviteler sizin sorumluluğunuzdadır.</li>
        <li>Şüpheli aktiviteyi tespit ederseniz derhal bize bildirin.</li>
      </ul>

      <h2>3. Kabul Edilmeyen Kullanım</h2>
      <p>Hizmeti aşağıdaki amaçlarla kullanmak yasaktır:</p>
      <ul>
        <li>Yasadışı faaliyetler (kaçakçılık, sahte ürün takibi vb.).</li>
        <li>Başkalarının verilerine yetkisiz erişim girişimi.</li>
        <li>Servisi reverse-engineer etmek, scraping, kapasite testleri.</li>
        <li>Spam, kötücül yazılım dağıtımı.</li>
        <li>API rate limit aşımıyla sistemi zorlama.</li>
      </ul>

      <h2>4. Hizmet Seviyesi</h2>
      <ul>
        <li>%99.5 uptime hedefimiz var ama garanti vermiyoruz.</li>
        <li>Planlı bakım için 48 saat önceden bildirim yaparız.</li>
        <li>Verilerinizin günlük yedeği alınır; 90 gün rotasyonla saklanır.</li>
      </ul>

      <h2>5. Fiyatlandırma ve İptal</h2>
      <ul>
        <li>Plan değişiklikleri bir sonraki fatura döneminde geçerli olur.</li>
        <li>İade politikası: ödediğiniz dönem için iade verilmez; iptal hemen geçerli olur.</li>
        <li>Ödeme yapılmazsa hesap 14 gün sonra dondurulur, 30 gün sonra silinir.</li>
      </ul>

      <h2>6. Veri Sahipliği</h2>
      <p>
        Hesabınıza yüklediğiniz tüm veri size aittir. Biz sadece hizmeti sunmak için işleriz.
        İstediğiniz zaman verinizi indirip hesabınızı kapatabilirsiniz.
      </p>

      <h2>7. Sorumluluk Sınırı</h2>
      <p>
        Hizmet &ldquo;olduğu gibi&rdquo; sunulur. Doğrudan/dolaylı zararlar için sorumluluğumuz ödediğiniz
        son 12 aylık abonelik tutarı ile sınırlıdır.
      </p>

      <h2>8. Sözleşmenin Değişikliği</h2>
      <p>
        Bu şartları güncelleyebiliriz. Önemli değişiklikleri e-posta ile bildirip 30 gün önceden duyururuz.
      </p>

      <h2>9. Yetkili Mahkeme</h2>
      <p>
        Bu sözleşmeden doğan uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.
      </p>

      <h2>10. İletişim</h2>
      <p>
        Sorularınız için: <a href="mailto:legal@stoktakip.app">legal@stoktakip.app</a>
      </p>
    </>
  );
}
