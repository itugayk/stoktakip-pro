"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Globe, Shield, Bell, Palette, Store, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <PageHeader title="Ayarlar" description="Uygulama tercihlerinizi yönetin" />

      {/* Business type & modules */}
      <Link href="/dashboard/settings/business" className="block">
        <Card className="transition-colors hover:bg-muted/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">İşletme Tipi & Modüller</p>
              <p className="text-xs text-muted-foreground">
                Sektörünüze uygun paneli seçin, modülleri aç/kapat yapın
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />Tema</CardTitle>
          <CardDescription>Arayüz görünümünü seçin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "light", label: "Aydınlık", icon: Sun },
              { value: "dark", label: "Karanlık", icon: Moon },
              { value: "system", label: "Sistem", icon: Monitor },
            ].map((t) => (
              <Button
                key={t.value}
                variant={theme === t.value ? "default" : "outline"}
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => { setTheme(t.value); toast.success(`Tema: ${t.label}`); }}
              >
                <t.icon className="h-5 w-5" />
                <span className="text-xs">{t.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Dil</CardTitle>
          <CardDescription>Arayüz dilini seçin</CardDescription>
        </CardHeader>
        <CardContent>
          <Select defaultValue="tr">
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">💰 Para Birimi</CardTitle>
          <CardDescription>Varsayılan para birimini seçin</CardDescription>
        </CardHeader>
        <CardContent>
          <Select defaultValue="TRY">
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TRY">₺ Türk Lirası (TRY)</SelectItem>
              <SelectItem value="USD">$ ABD Doları (USD)</SelectItem>
              <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Bildirimler</CardTitle>
          <CardDescription>Bildirim tercihlerinizi yönetin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Düşük stok uyarıları", desc: "Minimum stok seviyesine ulaşıldığında" },
            { label: "SKT uyarıları", desc: "Son kullanma tarihi yaklaşan ürünler" },
            { label: "Sipariş bildirimleri", desc: "Yeni sipariş ve durum değişiklikleri" },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">Aktif</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Güvenlik</CardTitle>
          <CardDescription>Hesap güvenlik ayarları</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">İki Faktörlü Doğrulama (2FA)</p>
              <p className="text-xs text-muted-foreground">Hesabınıza ek güvenlik katmanı ekleyin</p>
            </div>
            <Button variant="outline" size="sm">Etkinleştir</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Şifre Değiştir</p>
              <p className="text-xs text-muted-foreground">Son değişiklik: 30 gün önce</p>
            </div>
            <Button variant="outline" size="sm">Değiştir</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
