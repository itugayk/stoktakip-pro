import Link from "next/link";
import {
  Barcode,
  Warehouse as WarehouseIcon,
  CalendarClock,
  BarChart3,
  Users,
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingShell } from "@/components/marketing/marketing-shell";

const FEATURES = [
  {
    icon: Barcode,
    title: "Barkod & QR",
    description: "Kamera, USB veya Bluetooth okuyucu ile saniyeler içinde stok hareketi.",
  },
  {
    icon: WarehouseIcon,
    title: "Çoklu Depo",
    description: "Şube, raf, lokasyon — istediğiniz kadar fiziksel veya sanal depo.",
  },
  {
    icon: CalendarClock,
    title: "SKT Takibi",
    description: "Lot bazlı son kullanma tarihi yönetimi + özelleştirilebilir bildirim kuralları.",
  },
  {
    icon: BarChart3,
    title: "Akıllı Raporlar",
    description: "ABC analizi, devir hızı, kar/zarar, ölü stok — kararlarınızı veriyle alın.",
  },
  {
    icon: Users,
    title: "Ekip Yetkisi",
    description: "Rol bazlı erişim, depo bazlı izin, görev atama ve davet akışı.",
  },
  {
    icon: Smartphone,
    title: "Mobil + Offline",
    description: "PWA — internet kesilse bile stok girişi yapın, sonra otomatik senkron.",
  },
];

const HIGHLIGHTS = [
  "Çoklu kiracılı mimari + satır seviyesi güvenlik",
  "REST API + Webhook altyapısı (Zapier/n8n uyumlu)",
  "Türkçe + İngilizce arayüz, Türk vergi mevzuatına uyumlu",
  "Demo modunda Supabase'siz çalışır — kurulumdan önce dene",
];

export default function LandingPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container relative mx-auto px-4 py-20 md:py-32 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
            Stok yönetimi, <span className="text-primary">akıllı asistanınız</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Bulut tabanlı, çoklu depo, barkod destekli — KOBİ'ler için 21. yüzyıl stok takibi.
            Talep tahmini, otomatik sipariş önerisi, ölü stok uyarısı sizin yerinize düşünüyor.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild>
              <Link href="/register">
                Hemen Başla
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Demo'yu Dene</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Kredi kartı gerekmez · Türkçe destek · KVKK uyumlu
          </p>
        </div>
      </section>

      <section id="features" className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Neler yapabilirsiniz?</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Stok takibi sadece sayı saymak değil. Operasyondan analiz katmanına kadar bir bütün.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="grid gap-8 md:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Teknolojiniz, sizden öne</h2>
              <p className="mt-3 text-muted-foreground">
                StokTakip Pro modern stack üzerine kurulu. Hızlı, güvenli, ölçeklenebilir —
                ve API'ler sayesinde mevcut iş akışınızla konuşur.
              </p>
              <Button className="mt-6" asChild>
                <Link href="/pricing">
                  Fiyatları Gör
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ul className="space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Hazır mısınız?</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Dakikalar içinde kurun, ilk ürünlerinizi ekleyin, ekibinizi davet edin.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link href="/register">
            Ücretsiz Hesap Aç
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </MarketingShell>
  );
}
