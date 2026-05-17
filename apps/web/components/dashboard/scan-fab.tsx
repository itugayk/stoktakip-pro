"use client";

import Link from "next/link";
import { ScanLine } from "lucide-react";

/**
 * Floating action button anchored above the mobile bottom-nav. Single-tap →
 * jump straight to /dashboard/scanner.
 *
 * Hidden on md+ since the desktop sidebar already exposes the scanner link.
 */
export function ScanFab() {
  return (
    <Link
      href="/dashboard/scanner"
      aria-label="Barkod tara"
      className="md:hidden fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow active:scale-95"
      style={{
        // Sit just above the mobile-nav (h~14 + safe-area).
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
      }}
    >
      <ScanLine className="h-6 w-6" />
    </Link>
  );
}
