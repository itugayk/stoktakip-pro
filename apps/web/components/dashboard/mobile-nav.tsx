"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ScanLine, ClipboardList, BarChart3,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/products", label: "Ürünler", icon: Package },
  { href: "/dashboard/scanner", label: "Tara", icon: ScanLine },
  { href: "/dashboard/inventory", label: "Stok", icon: ClipboardList },
  { href: "/dashboard/reports", label: "Rapor", icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="grid grid-cols-5 px-2 py-1">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition-all duration-200 ${
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              <span className={`text-[10px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
