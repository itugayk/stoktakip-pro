"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, Mail, Lock, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { signUp } from "@/lib/actions/auth";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error(t("weakPassword")); return; }
    setLoading(true);

    try {
      const result = await signUp({ email, password, fullName, companyName });
      if (result.ok) {
        toast.success("Hesap oluşturuldu!", { description: "Dashboard'a yönlendiriliyorsunuz..." });
        setTimeout(() => router.push("/dashboard"), 500);
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
        <h2 className="text-2xl font-bold tracking-tight">{t("registerTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("registerSubtitle")}</p>
      </div>

      <Card className="border-0 shadow-none bg-transparent">
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4 p-0">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("fullName")}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="fullName" placeholder="Adınız Soyadınız" className="pl-9 h-11" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">{t("company")}</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="company" placeholder="Şirketinizin adı" className="pl-9 h-11" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="mail@sirket.com" className="pl-9 h-11" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-medium" disabled={loading} id="register-btn">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("register")}
            </Button>
          </CardContent>
        </form>

        <CardFooter className="p-0 pt-6">
          <p className="text-center text-sm text-muted-foreground w-full">
            {t("haveAccount")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("login")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
