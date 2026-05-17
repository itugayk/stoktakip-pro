"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reported, setReported] = useState(false);

  useEffect(() => {
    // Surface to console in dev; production logging happens via the
    // global-error boundary which writes structured JSON.
    console.error("Dashboard error:", error);
  }, [error]);

  const handleReport = async () => {
    try {
      await fetch("/api/error-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          digest: error.digest,
          stack: error.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }),
      });
      setReported(true);
      toast.success("Hata raporu gönderildi", {
        description: "İncelenmek üzere ekibimize iletildi.",
      });
    } catch {
      toast.error("Rapor gönderilemedi", {
        description: "Lütfen birazdan tekrar deneyin.",
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Bir Hata Oluştu</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sayfa yüklenirken bir sorun oluştu. Tekrar deneyebilir ya da bu hatayı bize iletebilirsiniz.
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted-foreground mb-4 font-mono">
              Referans: {error.digest}
            </p>
          )}
          {error.message && (
            <div className="mb-6 rounded-lg bg-muted p-3 text-xs text-muted-foreground font-mono text-left overflow-auto max-h-24">
              {error.message}
            </div>
          )}
          <div className="grid gap-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tekrar Dene
            </Button>
            <Button
              variant="outline"
              onClick={handleReport}
              disabled={reported}
              className="w-full"
            >
              {reported ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-emerald-500" />
                  Rapor gönderildi
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Hatayı Rapor Et
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
