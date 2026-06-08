"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { resetPassword } from "@/lib/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Şifre en az 8 karakter olmalı");
      return;
    }
    if (password !== confirm) {
      toast.error("Şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword({ token, password });
      if (result.ok) {
        toast.success("Şifreniz güncellendi", { description: "Yeni şifrenizle giriş yapabilirsiniz." });
        window.location.href = "/login";
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

      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Yeni şifre belirleyin</h2>
        <p className="text-sm text-muted-foreground">
          Hesabınız için yeni bir şifre girin. En az 8 karakter olmalıdır.
        </p>
      </div>

      <Card className="border-0 shadow-none bg-transparent">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 p-0">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Yeni şifre
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-11"
                  required
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-medium">
                Yeni şifre (tekrar)
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9 h-11"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Şifreyi güncelle
            </Button>

            <Link
              href="/login"
              className="flex items-center justify-center text-sm text-muted-foreground hover:text-foreground"
            >
              Girişe dön
            </Link>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
