import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingShell } from "@/components/marketing/marketing-shell";

interface Plan {
  id: "free" | "starter" | "professional" | "enterprise";
  name: string;
  price: { monthly: number; yearly: number } | "custom";
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Ücretsiz",
    price: { monthly: 0, yearly: 0 },
    description: "Tek kullanıcı, küçük envanter için.",
    features: [
      "1 kullanıcı",
      "100 ürüne kadar",
      "1 depo",
      "Barkod tarama",
      "Temel raporlar",
      "Demo destek",
    ],
    cta: "Hemen Başla",
    href: "/register",
  },
  {
    id: "starter",
    name: "Başlangıç",
    price: { monthly: 199, yearly: 1990 },
    description: "Küçük işletmeler için, ekip + çoklu depo.",
    features: [
      "5 kullanıcı",
      "1.000 ürüne kadar",
      "3 depo",
      "Çoklu depo + lokasyon QR",
      "SKT kural motoru",
      "Excel içe/dışa aktarma",
      "E-posta destek",
    ],
    cta: "14 Gün Ücretsiz Dene",
    href: "/register?plan=starter",
  },
  {
    id: "professional",
    name: "Profesyonel",
    price: { monthly: 499, yearly: 4990 },
    description: "Büyüyen işletmeler için API + entegrasyonlar.",
    features: [
      "20 kullanıcı",
      "Sınırsız ürün",
      "Sınırsız depo",
      "Public REST API + Webhooks",
      "Pazaryeri & muhasebe entegrasyonu",
      "Kar/Zarar analizi (FIFO/AVG/LIFO)",
      "Zamanlanmış raporlar",
      "Öncelikli destek",
    ],
    cta: "14 Gün Ücretsiz Dene",
    href: "/register?plan=professional",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Kurumsal",
    price: "custom",
    description: "Büyük operasyonlar, özel ihtiyaçlar.",
    features: [
      "Sınırsız kullanıcı",
      "SSO + SAML",
      "Adanmış altyapı",
      "Özel entegrasyon geliştirme",
      "SLA + 7/24 destek",
      "Adanmış hesap yöneticisi",
    ],
    cta: "İletişime Geç",
    href: "mailto:sales@stoktakip.app",
  },
];

const formatPrice = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Şirketinize uygun planı seçin
          </h1>
          <p className="mt-4 text-muted-foreground">
            İstediğiniz zaman iptal edin. KDV dahil fiyatlar. Yıllık ödemede 2 ay bedava.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.highlighted
                  ? "border-primary shadow-lg ring-2 ring-primary/20 relative"
                  : "hover:shadow-md transition-shadow"
              }
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">En Popüler</Badge>
              )}
              <CardContent className="p-6 flex flex-col h-full">
                <div className="mb-4">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                </div>

                <div className="mb-6">
                  {plan.price === "custom" ? (
                    <p className="text-2xl font-bold">Özel Fiyat</p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold tabular-nums">
                        {formatPrice(plan.price.monthly)}
                        <span className="text-sm font-normal text-muted-foreground">/ay</span>
                      </p>
                      {plan.price.yearly > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          veya {formatPrice(plan.price.yearly)}/yıl (2 ay bedava)
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2 text-sm flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-6 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  asChild
                >
                  <Link href={plan.href}>
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Sorularınız mı var? <a href="mailto:hello@stoktakip.app" className="text-primary hover:underline">Bizimle iletişime geçin</a>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
