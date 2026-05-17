"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toggleFavorite, type FavoriteEntity } from "@/lib/actions";
import { cn } from "@/lib/utils";

export interface FavoriteStarProps {
  entityType: FavoriteEntity;
  entityId: string;
  initial: boolean;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Toggle a star icon for the given entity. Optimistic; reverts on action
 * failure. Stops event propagation so clicking inside a table row doesn't
 * also open the row.
 */
export function FavoriteStar({
  entityType,
  entityId,
  initial,
  className,
  size = "sm",
}: FavoriteStarProps) {
  const [favorited, setFavorited] = useState(initial);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    const prev = favorited;
    setFavorited(!prev);
    setBusy(true);
    const result = await toggleFavorite({ entityType, entityId });
    setBusy(false);
    if (!result.ok) {
      setFavorited(prev);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      aria-label={favorited ? "Favoriden çıkar" : "Favorilere ekle"}
      className={cn(
        "rounded p-1 transition-colors hover:bg-muted/60 disabled:opacity-40",
        className
      )}
    >
      <Star
        className={cn(
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
          favorited
            ? "fill-amber-400 stroke-amber-500"
            : "stroke-muted-foreground"
        )}
      />
    </button>
  );
}
