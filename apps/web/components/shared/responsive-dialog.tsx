"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky bottom footer (e.g. submit / cancel buttons). Stays visible when
   *  the mobile keyboard opens. */
  footer?: React.ReactNode;
  /** Max width on desktop. */
  className?: string;
}

/**
 * Centered Dialog on desktop, bottom Sheet on mobile (<768px).
 *
 * The mobile sheet uses a sticky footer so the submit button remains visible
 * when the virtual keyboard appears.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "max-h-[90vh] rounded-t-xl flex flex-col p-0",
            className
          )}
        >
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="px-4 py-2 flex-1 overflow-y-auto">{children}</div>
          {footer && (
            <SheetFooter
              className="px-4 py-3 border-t border-border bg-background sticky bottom-0"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
            >
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg max-h-[85vh] overflow-y-auto", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
