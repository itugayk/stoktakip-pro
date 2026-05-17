"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFavorites, getProducts } from "@/lib/actions";
import type { ProductWithStock } from "@/lib/types";

export function FavoritesWidget() {
  const [items, setItems] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [fav, prod] = await Promise.all([getFavorites("product"), getProducts(undefined)]);
        if (!fav.ok || !prod.ok) return;
        const ids = new Set(fav.data.map((f) => f.entityId));
        setItems(prod.data.filter((p) => ids.has(p.id)).slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
          Favori Ürünler
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/products?q=${encodeURIComponent(p.name)}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">
                    {p.currentStock}
                    <span className="text-[10px] text-muted-foreground ml-1">{p.unit}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
