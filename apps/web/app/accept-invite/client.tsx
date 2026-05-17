"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { acceptInvitation } from "@/lib/actions";

export function AcceptInviteClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Geçersiz davet linki — token eksik");
      return;
    }
    acceptInvitation({ token }).then((r) => {
      if (r.ok) {
        setState("success");
        setMessage("Davete katıldınız! Yönlendiriliyorsunuz…");
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setState("error");
        setMessage(r.error.message);
      }
    });
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {state === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Davet kontrol ediliyor…</p>
            </>
          )}
          {state === "success" && (
            <>
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="h-7 w-7 text-emerald-500" />
              </div>
              <p className="text-lg font-semibold">Hoş geldiniz!</p>
              <p className="text-sm text-muted-foreground">{message}</p>
            </>
          )}
          {state === "error" && (
            <>
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-rose-500/10">
                <AlertTriangle className="h-7 w-7 text-rose-500" />
              </div>
              <p className="text-lg font-semibold">Davet kullanılamadı</p>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button onClick={() => router.push("/dashboard")}>Dashboard'a git</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
