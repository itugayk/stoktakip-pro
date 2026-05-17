"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableColumn } from "./columns";

export interface ColumnVisibilityProps<TRow> {
  columns: readonly DataTableColumn<TRow>[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}

export function ColumnVisibility<TRow>({
  columns,
  hidden,
  onToggle,
}: ColumnVisibilityProps<TRow>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Kolonlar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Görünür Kolonlar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={!hidden.has(col.id)}
            onCheckedChange={() => onToggle(col.id)}
          >
            {typeof col.header === "string" ? col.header : col.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
