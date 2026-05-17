import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ScanFab } from "@/components/dashboard/scan-fab";
import { CommandPalette, GlobalHotkeys } from "@/components/shared";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <a href="#main-content" className="skip-to-content sr-only focus:not-sr-only">
        İçeriğe atla
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0 pb-20 md:pb-0">
        <DashboardHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 overflow-x-hidden px-4 pb-28 pt-4 md:p-6 animate-fade-in"
        >
          {children}
        </main>
        <MobileNav />
        <ScanFab />
        <CommandPalette />
        <GlobalHotkeys />
      </SidebarInset>
    </SidebarProvider>
  );
}
