"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Share, Plus, MonitorDown, MoreVertical, Smartphone } from "lucide-react";

// `beforeinstallprompt` isn't in the standard lib DOM types yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type StandaloneNavigator = Navigator & { standalone?: boolean };

// Hydration-safe "are we on the client yet" flag (same pattern as ThemeToggle).
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as StandaloneNavigator).standalone === true
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 leading-relaxed">{children}</span>
    </li>
  );
}

export function InstallPWAButton() {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // suppress Chrome's mini-infobar; we own the button
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Don't show once the app is installed / already running as an installed app.
  if (!mounted || installed || isStandalone()) return null;

  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const insecure = !window.isSecureContext;

  const handleClick = async () => {
    // Native install prompt (Android / desktop Chrome / Edge) — install directly.
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    // Otherwise guide the user (iOS, or the prompt hasn't fired yet).
    setHelpOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        title="Uygulamayı indir / yükle"
        className="h-9 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">İndir</span>
      </Button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Uygulamayı Yükle</DialogTitle>
            <DialogDescription>
              StokTakip&apos;i telefonunuza veya bilgisayarınıza uygulama gibi kurup
              ana ekrandan tek dokunuşla açabilirsiniz.
            </DialogDescription>
          </DialogHeader>

          {insecure ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
              Kurulum için <b>güvenli (HTTPS)</b> adresten açmanız gerekir. Lütfen
              uygulamanın <b>https://</b> ile başlayan adresini kullanın.
            </div>
          ) : isIOS ? (
            <ol className="mt-1 space-y-4 text-sm">
              <Step n={1}>
                Safari&apos;de alttaki <Share className="inline h-4 w-4" />
                <b>Paylaş</b> butonuna dokunun.
              </Step>
              <Step n={2}>
                Menüden <Plus className="inline h-4 w-4" />
                <b>Ana Ekrana Ekle</b>&apos;yi seçin.
              </Step>
              <Step n={3}>
                <b>Ekle</b>&apos;ye dokunun — uygulama ana ekranınızda belirir.
              </Step>
            </ol>
          ) : (
            <ol className="mt-1 space-y-4 text-sm">
              <Step n={1}>
                <Smartphone className="inline h-4 w-4" /> Telefonda (Chrome): sağ üstteki
                <MoreVertical className="inline h-4 w-4" /> menüsünü açın.
              </Step>
              <Step n={2}>
                <MonitorDown className="inline h-4 w-4" /> Bilgisayarda (Chrome/Edge):
                adres çubuğunun sağındaki <b>yükle</b> simgesine tıklayın.
              </Step>
              <Step n={3}>
                Açılan menüden <b>&quot;Uygulamayı yükle&quot;</b> / <b>&quot;Ana ekrana ekle&quot;</b>&apos;yi seçin.
              </Step>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
