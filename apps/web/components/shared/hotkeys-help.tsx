"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { HOTKEYS, formatKeys, type Hotkey } from "@/lib/hotkeys";

export interface HotkeysHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HotkeysHelp({ open, onOpenChange }: HotkeysHelpProps) {
  const groups: Hotkey["group"][] = ["Genel", "Navigasyon", "Aksiyon"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Klavye Kısayolları</DialogTitle>
          <DialogDescription>
            Hızlı erişim için aşağıdaki kısayolları kullanabilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {groups.map((group) => {
            const items = HOTKEYS.filter((h) => h.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  {group}
                </h4>
                <div className="space-y-1">
                  {items.map((h) => (
                    <div
                      key={h.keys + h.description}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="text-muted-foreground">{h.description}</span>
                      <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-mono">
                        {formatKeys(h.keys)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
