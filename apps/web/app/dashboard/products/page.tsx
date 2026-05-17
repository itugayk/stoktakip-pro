import { Suspense } from "react";
import { ProductsPageClient } from "./page-client";

// `ProductsPageClient` reads `useSearchParams` (via `useTableState`) which
// suspends during prerender; wrap in Suspense to satisfy Next.js' boundary
// requirement without bailing out the whole route to dynamic.
export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-muted/60 rounded" />
          <div className="h-72 bg-muted/40 rounded" />
        </div>
      }
    >
      <ProductsPageClient />
    </Suspense>
  );
}
