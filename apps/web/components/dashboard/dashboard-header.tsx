"use client";

import { Search, Command as CommandIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { OfflineIndicator } from "@/components/shared/offline-indicator";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { isMac } from "@/lib/hotkeys";
import { useEffect, useState } from "react";

export function DashboardHeader() {
  const [modKey, setModKey] = useState<"⌘" | "Ctrl">("Ctrl");
  useEffect(() => setModKey(isMac() ? "⌘" : "Ctrl"), []);

  // Clicking or focusing the input fires the same Cmd+K shortcut the
  // CommandPalette is bound to, so the same dialog opens for either path.
  const openPalette = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: isMac(),
      ctrlKey: !isMac(),
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md md:gap-3 md:px-4">
      <SidebarTrigger className="-ml-1 h-9 w-9 shrink-0" />
      <Separator orientation="vertical" className="mr-1 hidden !h-5 md:block" />

      {/* Search Bar — opens the command palette on click/focus */}
      <div className="relative min-w-0 flex-1 md:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Ürün, sayfa veya aksiyon ara…"
          className="h-9 min-w-0 truncate border-0 bg-muted/50 pl-9 pr-16 text-sm focus-visible:ring-1 cursor-pointer"
          id="global-search"
          readOnly
          enterKeyHint="search"
          onClick={openPalette}
          onFocus={(e) => {
            // Don't keep the readonly input focused; just open the palette.
            e.currentTarget.blur();
            openPalette();
          }}
        />
        <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">
          {modKey === "⌘" ? <CommandIcon className="h-2.5 w-2.5" /> : <span>{modKey}</span>}
          <span>K</span>
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <OfflineIndicator />
        <NotificationsBell />
        <ThemeToggle />
      </div>
    </header>
  );
}
