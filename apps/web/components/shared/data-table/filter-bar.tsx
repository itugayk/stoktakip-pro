"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDescriptor {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface FilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDescriptor[];
  values: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}

const ALL = "all";

export function FilterBar({
  query,
  onQueryChange,
  searchPlaceholder = "Ara…",
  filters = [],
  values,
  onFilterChange,
}: FilterBarProps) {
  const hasActive = query !== "" || Object.values(values).some(Boolean);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
          enterKeyHint="search"
        />
      </div>
      {filters.map((f) => (
        <Select
          key={f.key}
          value={values[f.key] ?? ALL}
          onValueChange={(v) => onFilterChange(f.key, !v || v === ALL ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{f.label}: Tümü</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onQueryChange("");
            for (const k of Object.keys(values)) onFilterChange(k, "");
          }}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Temizle
        </Button>
      )}
    </div>
  );
}
