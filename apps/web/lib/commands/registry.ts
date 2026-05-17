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
  PackagePlus,
  PackageMinus,
  Tag,
  Plus,
  AlertTriangle,
  ClipboardList,
  Shield,
  Plug,
  Webhook,
  Key,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface CommandEntry {
  id: string;
  label: string;
  /** Group label in the palette. */
  group: "Navigasyon" | "Aksiyon";
  icon: LucideIcon;
  /** Either a target route or a deep-link with hash that pages can listen to. */
  href: string;
  /** Free-form search keywords (turkish + english). */
  keywords?: string[];
}

const NAV: CommandEntry[] = [
  { id: "nav-dashboard", label: "Dashboard", group: "Navigasyon", icon: LayoutDashboard, href: "/dashboard", keywords: ["ana sayfa", "home"] },
  { id: "nav-products", label: "Ürünler", group: "Navigasyon", icon: Package, href: "/dashboard/products", keywords: ["urun", "product"] },
  { id: "nav-categories", label: "Kategoriler", group: "Navigasyon", icon: Tag, href: "/dashboard/categories", keywords: ["kategori", "category"] },
  { id: "nav-inventory", label: "Stok Hareketleri", group: "Navigasyon", icon: ArrowRightLeft, href: "/dashboard/inventory", keywords: ["stok", "hareket", "movement"] },
  { id: "nav-expiry", label: "SKT Takibi", group: "Navigasyon", icon: CalendarClock, href: "/dashboard/inventory/expiry", keywords: ["skt", "expiry", "son kullanma"] },
  { id: "nav-counts", label: "Sayımlar", group: "Navigasyon", icon: ScanLine, href: "/dashboard/counts", keywords: ["sayim", "count"] },
  { id: "nav-reorder", label: "Sipariş Önerileri", group: "Navigasyon", icon: PackagePlus, href: "/dashboard/reorder", keywords: ["reorder", "siparis", "oneri"] },
  { id: "nav-turnover", label: "Devir Hızı", group: "Navigasyon", icon: BarChart3, href: "/dashboard/reports/turnover", keywords: ["turnover", "devir"] },
  { id: "nav-abc", label: "ABC Analizi", group: "Navigasyon", icon: BarChart3, href: "/dashboard/reports/abc", keywords: ["abc", "pareto"] },
  { id: "nav-deadstock", label: "Ölü Stok", group: "Navigasyon", icon: AlertTriangle, href: "/dashboard/reports/dead-stock", keywords: ["dead", "olu", "stok"] },
  { id: "nav-skt-rules", label: "SKT Kuralları", group: "Navigasyon", icon: Bell, href: "/dashboard/settings/rules/expiry", keywords: ["skt", "kural", "rule"] },
  { id: "nav-operations", label: "Operasyon Paneli", group: "Navigasyon", icon: BarChart3, href: "/dashboard/operations", keywords: ["operations", "operasyon"] },
  { id: "nav-returns", label: "İadeler", group: "Navigasyon", icon: ArrowRightLeft, href: "/dashboard/returns", keywords: ["iade", "rma", "return"] },
  { id: "nav-price-lists", label: "Fiyat Listeleri", group: "Navigasyon", icon: Tag, href: "/dashboard/price-lists", keywords: ["fiyat", "price"] },
  { id: "nav-profit", label: "Kar/Zarar", group: "Navigasyon", icon: BarChart3, href: "/dashboard/reports/profit", keywords: ["kar", "zarar", "profit", "p&l"] },
  { id: "nav-trends", label: "Trend Raporu", group: "Navigasyon", icon: BarChart3, href: "/dashboard/reports/trends", keywords: ["trend", "comparison"] },
  { id: "nav-scheduled", label: "Zamanlanmış Raporlar", group: "Navigasyon", icon: CalendarClock, href: "/dashboard/settings/scheduled-reports", keywords: ["scheduled", "zamanlama", "cron"] },
  { id: "nav-import", label: "Ürün İçe Aktarma", group: "Navigasyon", icon: Plus, href: "/dashboard/products/import", keywords: ["import", "xlsx", "ice aktar"] },
  { id: "nav-tasks", label: "Görevler", group: "Navigasyon", icon: ClipboardList, href: "/dashboard/tasks", keywords: ["tasks", "gorev"] },
  { id: "nav-team", label: "Ekip", group: "Navigasyon", icon: Users, href: "/dashboard/team", keywords: ["team", "ekip", "kullanici", "davet", "invite"] },
  { id: "nav-permissions", label: "Yetki Matrisi", group: "Navigasyon", icon: Shield, href: "/dashboard/settings/permissions", keywords: ["permissions", "yetki", "rol"] },
  { id: "nav-integrations", label: "Entegrasyonlar", group: "Navigasyon", icon: Plug, href: "/dashboard/integrations", keywords: ["integration", "shopify", "trendyol", "parasut"] },
  { id: "nav-api-keys", label: "API Anahtarları", group: "Navigasyon", icon: Key, href: "/dashboard/settings/api-keys", keywords: ["api", "key", "anahtar"] },
  { id: "nav-webhooks", label: "Webhooks", group: "Navigasyon", icon: Webhook, href: "/dashboard/settings/webhooks", keywords: ["webhook", "event"] },
  { id: "nav-api-docs", label: "API Dokümanı", group: "Navigasyon", icon: BookOpen, href: "/dashboard/settings/api-docs", keywords: ["docs", "doku", "rest", "zapier"] },
  { id: "nav-my-data", label: "Verilerim (KVKK)", group: "Navigasyon", icon: Shield, href: "/dashboard/settings/my-data", keywords: ["kvkk", "verilerim", "gdpr", "indir"] },
  { id: "nav-scanner", label: "Barkod Tarayıcı", group: "Navigasyon", icon: ScanLine, href: "/dashboard/scanner", keywords: ["barcode", "scan", "qr"] },
  { id: "nav-warehouses", label: "Depolar", group: "Navigasyon", icon: Warehouse, href: "/dashboard/warehouses", keywords: ["depo"] },
  { id: "nav-suppliers", label: "Tedarikçiler", group: "Navigasyon", icon: Truck, href: "/dashboard/suppliers" },
  { id: "nav-customers", label: "Müşteriler", group: "Navigasyon", icon: Users, href: "/dashboard/customers" },
  { id: "nav-po", label: "Satın Alma Siparişleri", group: "Navigasyon", icon: PackagePlus, href: "/dashboard/orders/purchase", keywords: ["po", "satin alma"] },
  { id: "nav-so", label: "Satış Siparişleri", group: "Navigasyon", icon: PackageMinus, href: "/dashboard/orders/sales", keywords: ["so", "satis"] },
  { id: "nav-reports", label: "Raporlar", group: "Navigasyon", icon: BarChart3, href: "/dashboard/reports", keywords: ["analiz", "report"] },
  { id: "nav-notifications", label: "Bildirimler", group: "Navigasyon", icon: Bell, href: "/dashboard/notifications" },
  { id: "nav-settings", label: "Ayarlar", group: "Navigasyon", icon: Settings, href: "/dashboard/settings", keywords: ["settings"] },
];

const ACTIONS: CommandEntry[] = [
  { id: "act-new-product", label: "Yeni ürün ekle", group: "Aksiyon", icon: Plus, href: "/dashboard/products#new", keywords: ["new product", "yeni urun", "ekle"] },
  { id: "act-stock-in", label: "Stok girişi", group: "Aksiyon", icon: PackagePlus, href: "/dashboard/inventory#in", keywords: ["giris", "stock in"] },
  { id: "act-stock-out", label: "Stok çıkışı", group: "Aksiyon", icon: PackageMinus, href: "/dashboard/inventory#out", keywords: ["cikis", "stock out"] },
  { id: "act-scan", label: "Barkod tara", group: "Aksiyon", icon: ScanLine, href: "/dashboard/scanner", keywords: ["scan", "tara"] },
  { id: "act-new-count", label: "Yeni sayım başlat", group: "Aksiyon", icon: Plus, href: "/dashboard/counts/new", keywords: ["sayim", "count"] },
  { id: "act-labels", label: "Barkod etiket yazdır", group: "Aksiyon", icon: Plus, href: "/dashboard/products/labels", keywords: ["label", "etiket", "barkod"] },
];

export const COMMAND_REGISTRY: CommandEntry[] = [...NAV, ...ACTIONS];
