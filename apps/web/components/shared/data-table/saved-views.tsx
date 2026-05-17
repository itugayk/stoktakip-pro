"use client";

import { useEffect, useState } from "react";
import { Bookmark, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { TableState } from "./use-table-state";

export interface SavedView {
  id: string;
  name: string;
  query: string;
  sort?: { id: string; dir: "asc" | "desc" };
  filters: Record<string, string>;
}

export interface SavedViewsProps {
  /** Stable namespace for localStorage (e.g. "products-table"). */
  storageKey: string;
  state: TableState;
  onApply: (view: SavedView) => void;
}

function loadViews(key: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`dt-views:${key}`);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

function persistViews(key: string, views: SavedView[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`dt-views:${key}`, JSON.stringify(views));
  } catch {
    /* localStorage full / disabled */
  }
}

/**
 * Save the current filters / search / sort as a named preset.
 *
 * Views live in localStorage (per-browser). A future migration could push
 * them to `profiles.preferences` to make them follow the user across devices.
 */
export function SavedViews({ storageKey, state, onApply }: SavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setViews(loadViews(storageKey));
  }, [storageKey]);

  const save = () => {
    if (!name.trim()) {
      toast.error("İsim girin");
      return;
    }
    const next: SavedView = {
      id: `v-${Date.now()}`,
      name: name.trim(),
      query: state.query,
      sort: state.sort ?? undefined,
      filters: { ...state.filters },
    };
    const updated = [next, ...views];
    setViews(updated);
    persistViews(storageKey, updated);
    setName("");
    setNaming(false);
    toast.success("Görünüm kaydedildi");
  };

  const remove = (id: string) => {
    const updated = views.filter((v) => v.id !== id);
    setViews(updated);
    persistViews(storageKey, updated);
  };

  if (naming) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setNaming(false);
              setName("");
            }
          }}
          placeholder="Görünüm adı"
          className="h-8 w-44"
        />
        <Button size="sm" onClick={save}>Kaydet</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setNaming(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark className="mr-2 h-4 w-4" />
          Görünümler
          {views.length > 0 && (
            <span className="ml-1 rounded bg-muted px-1 text-[10px] tabular-nums">
              {views.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Kayıtlı Görünümler</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center">
            Henüz kayıt yok
          </p>
        ) : (
          views.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => {
                  onApply(v);
                  toast.success(`"${v.name}" uygulandı`);
                }}
                className="flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {v.name}
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => remove(v.id)}
                aria-label="Görünümü sil"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setNaming(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Mevcut filtreyi kaydet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
