"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { signIn } from "@/lib/actions/auth";

export default function LoginPage() {
  const t = useTranslations("auth");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("demo@demo.com");
  const [password, setPassword] = useState("demo");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      if (cleanEmail === "demo@demo.com" && cleanPassword === "demo") {
        toast.success("Giriş başarılı!", {
          description: "Dashboard'a yönlendiriliyorsunuz...",
        });
        window.location.href = "/dashboard";
        return;
      }

      const result = await signIn({ email, password });

      if (result.ok) {
        toast.success("Giriş başarılı!", {
          description: "Dashboard'a yönlendiriliyorsunuz...",
        });
        window.location.href = "/dashboard";
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
      {/* Mobile logo */}
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
        <h2 className="text-2xl font-bold tracking-tight">{t("loginTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      </div>

      <Card className="border-0 shadow-none bg-transparent">
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 p-0">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t("email")}
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
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t("password")}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
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

            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={loading}
              id="login-btn"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("login")}
            </Button>
          </CardContent>
        </form>

        <CardFooter className="flex-col gap-3 p-0 pt-6">
          <div className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              {t("register")}
            </Link>
          </div>

          {/* Demo hint */}
          <div className="w-full rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              🚀 <strong>Demo Modu:</strong> Giriş için şu bilgileri kullanın:<br/>
              <strong>E-posta:</strong> demo@demo.com <br/>
              <strong>Şifre:</strong> demo
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
