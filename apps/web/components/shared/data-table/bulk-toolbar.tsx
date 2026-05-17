"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkToolbarProps {
  selectedCount: number;
  onClear: () => void;
  actions: React.ReactNode;
}

/**
 * Slides up from below the toolbar when at least one row is selected.
 * Displays counter + cleared-out by user, plus passes through `actions`.
 */
export function BulkToolbar({ selectedCount, onClear, actions }: BulkToolbarProps) {
  if (selectedCount === 0) return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear} aria-label="Seçimi temizle">
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{selectedCount} satır seçildi</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
