"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await requestPasswordReset({ email });
      if (result.ok) {
        setSent(true);
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-8 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md">
          ST
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">StokTakip</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">PRO</p>
        </div>
      </div>

      {sent ? (
        <div className="space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">E-postanızı kontrol edin</h2>
            <p className="text-sm text-muted-foreground">
              Girdiğiniz adres kayıtlıysa, şifre sıfırlama bağlantısı içeren bir e-posta gönderdik.
              Bağlantı 1 saat boyunca geçerlidir.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Girişe dön
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Şifrenizi mi unuttunuz?</h2>
            <p className="text-sm text-muted-foreground">
              Hesabınızın e-posta adresini girin, size sıfırlama bağlantısı gönderelim.
            </p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 p-0">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    E-posta
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@stoktakip.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-11"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sıfırlama bağlantısı gönder
                </Button>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Girişe dön
                </Link>
              </CardContent>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
