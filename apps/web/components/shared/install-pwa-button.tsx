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
import { Download, Share, Plus } from "lucide-react";

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

export function InstallPWAButton() {
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Stop Chrome's default mini-infobar; we trigger the prompt from our button.
      e.preventDefault();
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

  // Render nothing until hydrated, or if already installed / running standalone.
  if (!mounted || installed || isStandalone()) return null;

  // Android / desktop Chrome / Edge — native install prompt available.
  if (deferred) {
    const install = async () => {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    };
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-primary"
        onClick={install}
        title="Uygulamayı indir"
      >
        <Download className="h-4 w-4" />
        <span className="sr-only">Uygulamayı indir</span>
      </Button>
    );
  }

  // iOS Safari — no install event; guide the user through Share → Add to Home Screen.
  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  if (isIOS) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary"
          onClick={() => setIosOpen(true)}
          title="Ana ekrana ekle"
        >
          <Download className="h-4 w-4" />
          <span className="sr-only">Ana ekrana ekle</span>
        </Button>
        <Dialog open={iosOpen} onOpenChange={setIosOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Telefona ekle</DialogTitle>
              <DialogDescription>
                StokTakip&apos;i iPhone/iPad ana ekranınıza ekleyip uygulama gibi
                kullanabilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <ol className="mt-2 space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  Safari&apos;de alttaki
                  <Share className="inline h-4 w-4" />
                  <b>Paylaş</b> butonuna dokunun.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  2
                </span>
                <span className="flex items-center gap-1.5">
                  Menüden
                  <Plus className="inline h-4 w-4" />
                  <b>Ana Ekrana Ekle</b>&apos;yi seçin.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  3
                </span>
                <span>
                  <b>Ekle</b>&apos;ye dokunun — uygulama ana ekranınızda belirecek.
                </span>
              </li>
            </ol>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Not installable on this browser (e.g. desktop Firefox/Safari) → render nothing.
  return null;
}
