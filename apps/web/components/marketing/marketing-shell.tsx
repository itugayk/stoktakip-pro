import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Public-facing shell used by /, /pricing, /legal/*. Simple header + footer,
 * no auth-protected sidebar. Kept as a server component — no client state.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package className="h-4 w-4" />
            </div>
            StokTakip Pro
          </Link>
          <nav className="ml-8 hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">Özellikler</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Fiyatlandırma</Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Yasal</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Giriş</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Ücretsiz Dene</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Package className="h-3.5 w-3.5" />
              </div>
              StokTakip Pro
            </Link>
            <p className="text-xs text-muted-foreground">
              KOBİ'ler için bulut tabanlı stok yönetim sistemi.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Ürün</p>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/#features" className="text-muted-foreground hover:text-foreground">Özellikler</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground">Fiyatlandırma</Link></li>
              <li><Link href="/login" className="text-muted-foreground hover:text-foreground">Demo</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Şirket</p>
            <ul className="space-y-1.5 text-sm">
              <li><a href="mailto:hello@stoktakip.app" className="text-muted-foreground hover:text-foreground">İletişim</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Yasal</p>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground">Gizlilik</Link></li>
              <li><Link href="/legal/terms" className="text-muted-foreground hover:text-foreground">Kullanım Şartları</Link></li>
              <li><Link href="/legal/kvkk" className="text-muted-foreground hover:text-foreground">KVKK</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="container mx-auto px-4 py-4 text-xs text-muted-foreground text-center">
            © 2026 StokTakip Pro. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}
