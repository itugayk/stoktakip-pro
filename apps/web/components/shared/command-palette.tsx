"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { COMMAND_REGISTRY, type CommandEntry } from "@/lib/commands/registry";
import { searchEverything, type SearchResults } from "@/lib/actions";
import { Package, Truck, Users, Clock } from "lucide-react";
import { useHotkey } from "@/hooks/use-hotkey";

const RECENT_KEY = "stoktakip-recent-commands";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  if (typeof window === "undefined") return;
  const current = loadRecent().filter((x) => x !== id);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...current].slice(0, MAX_RECENT)));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bind Cmd/Ctrl+K to toggle the palette.
  useHotkey("mod+k", (e) => {
    e.preventDefault();
    setOpen((o) => !o);
  });

  // Refresh recent list each time the palette opens.
  useEffect(() => {
    if (open) {
      setRecentIds(loadRecent());
      setQuery("");
      setResults(null);
    }
  }, [open]);

  // Debounced server search for entity matches.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !open) {
      setResults(null);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchEverything(query);
      if (res.ok) setResults(res.data);
      setSearching(false);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const recent = useMemo(
    () =>
      recentIds
        .map((id) => COMMAND_REGISTRY.find((c) => c.id === id))
        .filter((c): c is CommandEntry => Boolean(c)),
    [recentIds]
  );

  const navItems = useMemo(
    () => COMMAND_REGISTRY.filter((c) => c.group === "Navigasyon"),
    []
  );
  const actionItems = useMemo(
    () => COMMAND_REGISTRY.filter((c) => c.group === "Aksiyon"),
    []
  );

  const run = (entry: CommandEntry) => {
    saveRecent(entry.id);
    setOpen(false);
    router.push(entry.href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="max-w-xl">
      <CommandInput
        placeholder="Ürün, sayfa veya aksiyon ara…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Aranıyor…" : "Eşleşen bir şey bulunamadı."}
        </CommandEmpty>

        {!query && recent.length > 0 && (
          <>
            <CommandGroup heading="Son Kullanılanlar">
              {recent.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`recent ${c.label}`}
                  onSelect={() => run(c)}
                >
                  <Clock className="h-4 w-4" />
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigasyon">
          {navItems.map((c) => {
            const Icon = c.icon;
            return (
              <CommandItem
                key={c.id}
                value={`${c.label} ${c.keywords?.join(" ") ?? ""}`}
                onSelect={() => run(c)}
              >
                <Icon className="h-4 w-4" />
                {c.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="Aksiyon">
          {actionItems.map((c) => {
            const Icon = c.icon;
            return (
              <CommandItem
                key={c.id}
                value={`${c.label} ${c.keywords?.join(" ") ?? ""}`}
                onSelect={() => run(c)}
              >
                <Icon className="h-4 w-4" />
                {c.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {results && (results.products.length + results.suppliers.length + results.customers.length) > 0 && (
          <>
            <CommandSeparator />
            {results.products.length > 0 && (
              <CommandGroup heading="Ürünler">
                {results.products.map((p) => (
                  <CommandItem
                    key={`p-${p.id}`}
                    value={`product ${p.name} ${p.sku}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/dashboard/products?q=${encodeURIComponent(p.name)}`);
                    }}
                  >
                    <Package className="h-4 w-4" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground font-mono">
                      {p.sku}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.suppliers.length > 0 && (
              <CommandGroup heading="Tedarikçiler">
                {results.suppliers.map((s) => (
                  <CommandItem
                    key={`s-${s.id}`}
                    value={`supplier ${s.name}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push("/dashboard/suppliers");
                    }}
                  >
                    <Truck className="h-4 w-4" />
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.customers.length > 0 && (
              <CommandGroup heading="Müşteriler">
                {results.customers.map((c) => (
                  <CommandItem
                    key={`c-${c.id}`}
                    value={`customer ${c.name}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push("/dashboard/customers");
                    }}
                  >
                    <Users className="h-4 w-4" />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
