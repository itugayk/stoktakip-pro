"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/actions/auth";

type Status = "loading" | "success" | "error";

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    // Run exactly once. Doing this in the browser (not server render) means
    // e-mail link scanners that fetch the URL without running JS won't consume
    // the single-use token before the real user clicks.
    if (ran.current) return;
    ran.current = true;
    verifyEmail(token)
      .then((r) => {
        if (r.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(r.error.message);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Bir hata oluştu");
      });
  }, [token]);

  return (
    <div className="animate-fade-in space-y-6">
      {status === "loading" && (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Doğrulanıyor…</h2>
            <p className="text-sm text-muted-foreground">Lütfen bekleyin.</p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">E-postanız doğrulandı</h2>
            <p className="text-sm text-muted-foreground">
              Hesabınız etkinleştirildi. Artık kullanıcı adınız veya e-postanızla giriş yapabilirsiniz.
            </p>
          </div>
          <Button asChild className="w-full h-11 font-medium">
            <Link href="/login">Giriş yap</Link>
          </Button>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Doğrulanamadı</h2>
            <p className="text-sm text-muted-foreground">
              {message || "Bağlantı geçersiz veya süresi dolmuş."}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full h-11">
            <Link href="/login">Girişe dön</Link>
          </Button>
        </>
      )}
    </div>
  );
}
