import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  cta?: React.ReactNode;
  className?: string;
}

/**
 * Standard "no data" panel. Use inside Card/Table cells when a list is empty.
 * For full-page emptiness, wrap with a Card.
 */
export function EmptyState({ icon: Icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className
      )}
    >
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-4">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
