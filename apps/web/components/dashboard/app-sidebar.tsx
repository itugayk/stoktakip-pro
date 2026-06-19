"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Truck,
  Users,
  BarChart3,
  ScanLine,
  Settings,
  Bell,
  ArrowRightLeft,
  CalendarClock,
  ClipboardList,
  PackagePlus,
  PackageMinus,
  LogOut,
  Tag,
  Plug,
  ChefHat,
  ShoppingCart,
  Wallet,
  FileText,
  BookUser,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/actions/auth";
import {
  ALL_MODULES,
  isHrefEnabled,
  term,
  type BusinessType,
  type ModuleKey,
} from "@/lib/modules/registry";

type UserInfo = { fullName: string; email: string; initials: string };

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [user, setUser] = useState<UserInfo>({ fullName: "Admin", email: "admin@stoktakip.com", initials: "AD" });
  // Optimistic: show everything until we know the company's enabled set, then
  // trim. Avoids a broken-looking near-empty menu on first paint.
  const [modules, setModules] = useState<ModuleKey[]>(ALL_MODULES);
  const [businessType, setBusinessType] = useState<BusinessType>("general");

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) {
        const parts = u.fullName.split(" ");
        const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : u.fullName.slice(0, 2).toUpperCase();
        setUser({ fullName: u.fullName, email: u.email, initials });
        setModules(u.company.enabledModules);
        setBusinessType(u.company.businessType);
      }
    });
  }, []);

  const mainNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, exact: true },
    { href: "/dashboard/sales/quick", label: "Hızlı Satış", icon: ShoppingCart },
    { href: "/dashboard/products", label: term(businessType, "products", t("products")), icon: Package },
    { href: "/dashboard/categories", label: term(businessType, "categories", "Kategoriler"), icon: Tag },
    { href: "/dashboard/scanner", label: t("scanner"), icon: ScanLine },
  ];

  const inventoryNav = [
    { href: "/dashboard/inventory", label: t("stockMovements"), icon: ArrowRightLeft, exact: true },
    { href: "/dashboard/inventory/expiry", label: t("expiryTracking"), icon: CalendarClock },
    { href: "/dashboard/recipes", label: "Reçeteler", icon: ChefHat },
    { href: "/dashboard/counts", label: "Sayımlar", icon: ClipboardList },
    { href: "/dashboard/reorder", label: "Sipariş Önerileri", icon: PackagePlus },
  ];

  const operationsNav = [
    { href: "/dashboard/operations", label: "Operasyon", icon: ClipboardList },
    { href: "/dashboard/warehouses", label: t("warehouses"), icon: Warehouse },
    { href: "/dashboard/suppliers", label: t("suppliers"), icon: Truck },
    { href: "/dashboard/customers", label: t("customers"), icon: Users },
    { href: "/dashboard/orders/purchase", label: t("purchaseOrders"), icon: PackagePlus },
    { href: "/dashboard/orders/sales", label: t("salesOrders"), icon: PackageMinus },
    { href: "/dashboard/delivery-notes", label: "İrsaliyeler", icon: FileText },
    { href: "/dashboard/payments", label: "Ödemeler", icon: Wallet },
    { href: "/dashboard/accounts", label: "Cari Hesaplar", icon: BookUser },
    { href: "/dashboard/returns", label: "İadeler", icon: ArrowRightLeft },
    { href: "/dashboard/price-lists", label: "Fiyat Listeleri", icon: Tag },
  ];

  const systemNav = [
    { href: "/dashboard/reports", label: t("reports"), icon: BarChart3 },
    { href: "/dashboard/tasks", label: "Görevler", icon: ClipboardList },
    { href: "/dashboard/team", label: "Ekip", icon: Users },
    { href: "/dashboard/integrations", label: "Entegrasyonlar", icon: Plug },
    { href: "/dashboard/notifications", label: t("notifications"), icon: Bell },
    { href: "/dashboard/settings", label: t("settings"), icon: Settings },
  ];

  type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const visible = (items: NavItem[]) =>
    items.filter((item) => isHrefEnabled(item.href, modules));

  const renderGroup = (rawItems: NavItem[], label?: string) => {
    const items = visible(rawItems);
    if (items.length === 0) return null;
    return (
    <SidebarGroup>
      {label && (
        <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/60 px-3 mb-1">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={active
                    ? "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }
                >
                  <Link href={item.href}>
                    <item.icon className={`h-[18px] w-[18px] ${active ? "text-primary" : ""}`} />
                    <span className="text-[13px]">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r-0">
      {/* Header / Logo */}
      <SidebarHeader className="px-3 py-5 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-3 group px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold text-xs shadow-lg shadow-primary/25 group-hover:shadow-primary/40 group-hover:scale-[1.03] transition-all duration-200">
            ST
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-[15px] font-bold tracking-tight leading-none">StokTakip</span>
            <span className="text-[9px] text-primary font-bold uppercase tracking-[0.2em] mt-0.5">
              PRO
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-1.5 pt-2">
        {renderGroup(mainNav)}
        {renderGroup(inventoryNav, "Stok İşlemleri")}
        {renderGroup(operationsNav, "Operasyonlar")}
        {renderGroup(systemNav, "Sistem")}
      </SidebarContent>

      {/* Footer / User + Logout — plain markup, no dropdown.
          Logout is a real <a href="/logout"> so it works without JS/hydration. */}
      <SidebarFooter className="border-t border-border/50 p-2 gap-1">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Avatar className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <AvatarFallback className="rounded-lg bg-transparent text-primary text-xs font-bold">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium text-[13px]">{user.fullName}</span>
            <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Çıkış Yap"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 font-medium"
            >
              <a href="/logout">
                <LogOut className="h-[18px] w-[18px]" />
                <span className="text-[13px]">Çıkış Yap</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
