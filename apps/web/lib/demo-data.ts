import type {
  Category,
  ProductWithStock,
  StockMovement,
  Warehouse,
  InventoryLot,
  Supplier,
  Customer,
} from "./types";

// ========================
// Categories
// ========================
export const demoCategories: Category[] = [
  { id: "cat-1", name: "İlaçlar", color: "#6366f1", icon: "💊" },
  { id: "cat-2", name: "Vitaminler", color: "#22c55e", icon: "🧬" },
  { id: "cat-3", name: "Kozmetik", color: "#ec4899", icon: "💄" },
  { id: "cat-4", name: "Gıda Takviyeleri", color: "#f59e0b", icon: "🥤" },
  { id: "cat-5", name: "Medikal Cihaz", color: "#06b6d4", icon: "🩺" },
  { id: "cat-6", name: "Temizlik", color: "#8b5cf6", icon: "🧴" },
  { id: "cat-7", name: "Bebek Ürünleri", color: "#f43f5e", icon: "🍼" },
  { id: "cat-8", name: "Kırtasiye", color: "#14b8a6", icon: "📎" },
];

// ========================
// Products
// ========================
const baseDemoProducts: Omit<ProductWithStock, "reservedStock" | "availableStock">[] = [
  {
    id: "prod-1", name: "Paracetamol 500mg", sku: "ILC-001", barcode: "8691234567890",
    description: "Ağrı kesici ve ateş düşürücü, 20 tablet", categoryId: "cat-1",
    unit: "kutu", minStock: 50, maxStock: 500, purchasePrice: 12.50, salePrice: 18.90,
    isActive: true, createdAt: "2026-01-15", updatedAt: "2026-05-10",
    currentStock: 342, categoryName: "İlaçlar", stockStatus: "ok",
  },
  {
    id: "prod-2", name: "Vitamin C 1000mg", sku: "VIT-001", barcode: "8691234567891",
    description: "C Vitamini takviyesi, 30 tablet", categoryId: "cat-2",
    unit: "kutu", minStock: 30, maxStock: 300, purchasePrice: 45.00, salePrice: 69.90,
    isActive: true, createdAt: "2026-01-20", updatedAt: "2026-05-12",
    currentStock: 28, categoryName: "Vitaminler", stockStatus: "low",
  },
  {
    id: "prod-3", name: "Antibiyotik Kapsül 250mg", sku: "ILC-002", barcode: "8691234567892",
    description: "Geniş spektrumlu antibiyotik, 16 kapsül", categoryId: "cat-1",
    unit: "kutu", minStock: 40, maxStock: 400, purchasePrice: 35.00, salePrice: 52.50,
    isActive: true, createdAt: "2026-02-01", updatedAt: "2026-05-11",
    currentStock: 156, categoryName: "İlaçlar", stockStatus: "ok",
  },
  {
    id: "prod-4", name: "Ağrı Kesici Jel 75ml", sku: "ILC-003", barcode: "8691234567893",
    description: "Topikal ağrı kesici jel", categoryId: "cat-1",
    unit: "adet", minStock: 25, maxStock: 200, purchasePrice: 28.00, salePrice: 42.90,
    isActive: true, createdAt: "2026-02-10", updatedAt: "2026-05-09",
    currentStock: 89, categoryName: "İlaçlar", stockStatus: "ok",
  },
  {
    id: "prod-5", name: "Omega 3 Balık Yağı", sku: "VIT-002", barcode: "8691234567894",
    description: "Omega 3 takviyesi, 60 kapsül", categoryId: "cat-2",
    unit: "kutu", minStock: 20, maxStock: 250, purchasePrice: 85.00, salePrice: 129.90,
    isActive: true, createdAt: "2026-02-15", updatedAt: "2026-05-08",
    currentStock: 15, categoryName: "Vitaminler", stockStatus: "critical",
  },
  {
    id: "prod-6", name: "Vitamin D3 1000 IU", sku: "VIT-003", barcode: "8691234567895",
    description: "D3 vitamini damla, 20ml", categoryId: "cat-2",
    unit: "adet", minStock: 30, maxStock: 300, purchasePrice: 55.00, salePrice: 84.90,
    isActive: true, createdAt: "2026-02-20", updatedAt: "2026-05-07",
    currentStock: 210, categoryName: "Vitaminler", stockStatus: "ok",
  },
  {
    id: "prod-7", name: "Nemlendirici Krem 50ml", sku: "KZM-001", barcode: "8691234567896",
    description: "Günlük nemlendirici yüz kremi", categoryId: "cat-3",
    unit: "adet", minStock: 15, maxStock: 150, purchasePrice: 42.00, salePrice: 65.00,
    isActive: true, createdAt: "2026-03-01", updatedAt: "2026-05-06",
    currentStock: 72, categoryName: "Kozmetik", stockStatus: "ok",
  },
  {
    id: "prod-8", name: "Probiyotik Kapsül", sku: "GDA-001", barcode: "8691234567897",
    description: "Probiyotik takviye, 30 kapsül", categoryId: "cat-4",
    unit: "kutu", minStock: 20, maxStock: 200, purchasePrice: 95.00, salePrice: 149.90,
    isActive: true, createdAt: "2026-03-05", updatedAt: "2026-05-10",
    currentStock: 45, categoryName: "Gıda Takviyeleri", stockStatus: "ok",
  },
  {
    id: "prod-9", name: "Dijital Tansiyon Aleti", sku: "MED-001", barcode: "8691234567898",
    description: "Koldan ölçüm, dijital ekranlı", categoryId: "cat-5",
    unit: "adet", minStock: 5, maxStock: 50, purchasePrice: 280.00, salePrice: 420.00,
    isActive: true, createdAt: "2026-03-10", updatedAt: "2026-05-05",
    currentStock: 12, categoryName: "Medikal Cihaz", stockStatus: "ok",
  },
  {
    id: "prod-10", name: "El Dezenfektanı 500ml", sku: "TMZ-001", barcode: "8691234567899",
    description: "%70 alkol içerikli el dezenfektanı", categoryId: "cat-6",
    unit: "adet", minStock: 40, maxStock: 400, purchasePrice: 15.00, salePrice: 24.90,
    isActive: true, createdAt: "2026-03-15", updatedAt: "2026-05-11",
    currentStock: 8, categoryName: "Temizlik", stockStatus: "critical",
  },
  {
    id: "prod-11", name: "Bebek Bezi No:3 (40'lı)", sku: "BBK-001", barcode: "8691234567900",
    description: "4-9 kg bebek bezi ekonomi paket", categoryId: "cat-7",
    unit: "paket", minStock: 20, maxStock: 200, purchasePrice: 120.00, salePrice: 179.90,
    isActive: true, createdAt: "2026-03-20", updatedAt: "2026-05-04",
    currentStock: 67, categoryName: "Bebek Ürünleri", stockStatus: "ok",
  },
  {
    id: "prod-12", name: "A4 Fotokopi Kağıdı (500'lü)", sku: "KRT-001", barcode: "8691234567901",
    description: "80gr A4 beyaz fotokopi kağıdı", categoryId: "cat-8",
    unit: "paket", minStock: 10, maxStock: 100, purchasePrice: 65.00, salePrice: 95.00,
    isActive: true, createdAt: "2026-04-01", updatedAt: "2026-05-12",
    currentStock: 34, categoryName: "Kırtasiye", stockStatus: "ok",
  },
];

export const demoProducts: ProductWithStock[] = baseDemoProducts.map((p) => ({
  ...p,
  reservedStock: 0,
  availableStock: p.currentStock,
}));

// ========================
// Warehouses
// ========================
export const demoWarehouses: Warehouse[] = [
  { id: "wh-1", name: "Ana Depo", address: "Organize Sanayi Bölgesi, No: 12", managerId: "u-1", managerName: "Ahmet Yılmaz", isActive: true, totalProducts: 12, totalQuantity: 1078 },
  { id: "wh-2", name: "Şube Depo", address: "Merkez Mah. İstiklal Cad. No: 45", managerId: "u-2", managerName: "Mehmet Kaya", isActive: true, totalProducts: 8, totalQuantity: 450 },
  { id: "wh-3", name: "E-Ticaret Deposu", address: "Lojistik Merkezi, Blok C", managerId: "u-1", managerName: "Ahmet Yılmaz", isActive: true, totalProducts: 10, totalQuantity: 320 },
];

// ========================
// Stock Movements
// ========================
export const demoMovements: StockMovement[] = [
  { id: "mv-1", productId: "prod-1", productName: "Paracetamol 500mg", productSku: "ILC-001", type: "in", quantity: 500, warehouseId: "wh-1", warehouseName: "Ana Depo", reason: "Tedarikçi siparişi", reference: "PO-2026-001", userId: "u-1", userName: "Ahmet Y.", createdAt: "2026-05-14T14:30:00" },
  { id: "mv-2", productId: "prod-2", productName: "Vitamin C 1000mg", productSku: "VIT-001", type: "out", quantity: 120, warehouseId: "wh-2", warehouseName: "Şube Depo", reason: "Müşteri satışı", reference: "SO-2026-045", userId: "u-2", userName: "Mehmet K.", createdAt: "2026-05-14T12:15:00" },
  { id: "mv-3", productId: "prod-3", productName: "Antibiyotik Kapsül 250mg", productSku: "ILC-002", type: "in", quantity: 200, warehouseId: "wh-1", warehouseName: "Ana Depo", reason: "Tedarikçi siparişi", reference: "PO-2026-002", userId: "u-1", userName: "Ahmet Y.", createdAt: "2026-05-14T10:00:00" },
  { id: "mv-4", productId: "prod-4", productName: "Ağrı Kesici Jel 75ml", productSku: "ILC-003", type: "out", quantity: 45, warehouseId: "wh-1", warehouseName: "Ana Depo", reason: "Şube transferi", userId: "u-3", userName: "Ayşe D.", createdAt: "2026-05-13T16:45:00" },
  { id: "mv-5", productId: "prod-5", productName: "Omega 3 Balık Yağı", productSku: "VIT-002", type: "transfer", quantity: 80, warehouseId: "wh-1", warehouseName: "Ana Depo", toWarehouseId: "wh-2", toWarehouseName: "Şube Depo", reason: "Stok dengeleme", userId: "u-2", userName: "Mehmet K.", createdAt: "2026-05-13T11:20:00" },
  { id: "mv-6", productId: "prod-10", productName: "El Dezenfektanı 500ml", productSku: "TMZ-001", type: "in", quantity: 300, warehouseId: "wh-1", warehouseName: "Ana Depo", reason: "Acil tedarik", reference: "PO-2026-003", userId: "u-1", userName: "Ahmet Y.", createdAt: "2026-05-12T09:00:00" },
  { id: "mv-7", productId: "prod-8", productName: "Probiyotik Kapsül", productSku: "GDA-001", type: "out", quantity: 25, warehouseId: "wh-3", warehouseName: "E-Ticaret Deposu", reason: "Online sipariş", reference: "SO-2026-046", userId: "u-1", userName: "Ahmet Y.", createdAt: "2026-05-12T15:30:00" },
  { id: "mv-8", productId: "prod-6", productName: "Vitamin D3 1000 IU", productSku: "VIT-003", type: "adjustment", quantity: -5, warehouseId: "wh-2", warehouseName: "Şube Depo", reason: "Sayım farkı düzeltmesi", userId: "u-2", userName: "Mehmet K.", createdAt: "2026-05-11T14:00:00" },
];

// ========================
// Inventory Lots (with expiry)
// ========================
export const demoLots: InventoryLot[] = [
  { id: "lot-1", productId: "prod-1", productName: "Paracetamol 500mg", lotNumber: "LOT-2024-A12", quantity: 120, expiryDate: "2026-05-19", warehouseId: "wh-1", warehouseName: "Ana Depo", receivedAt: "2024-06-15" },
  { id: "lot-2", productId: "prod-6", productName: "Vitamin D3 1000 IU", lotNumber: "LOT-2024-B08", quantity: 45, expiryDate: "2026-05-26", warehouseId: "wh-1", warehouseName: "Ana Depo", receivedAt: "2024-08-20" },
  { id: "lot-3", productId: "prod-8", productName: "Probiyotik Kapsül", lotNumber: "LOT-2024-C15", quantity: 200, expiryDate: "2026-06-06", warehouseId: "wh-1", warehouseName: "Ana Depo", receivedAt: "2024-10-01" },
  { id: "lot-4", productId: "prod-2", productName: "Vitamin C 1000mg", lotNumber: "LOT-2025-A01", quantity: 150, expiryDate: "2027-01-15", warehouseId: "wh-2", warehouseName: "Şube Depo", receivedAt: "2025-01-15" },
  { id: "lot-5", productId: "prod-5", productName: "Omega 3 Balık Yağı", lotNumber: "LOT-2025-A05", quantity: 80, expiryDate: "2026-08-30", warehouseId: "wh-1", warehouseName: "Ana Depo", receivedAt: "2025-02-10" },
  { id: "lot-6", productId: "prod-3", productName: "Antibiyotik Kapsül 250mg", lotNumber: "LOT-2025-B03", quantity: 100, expiryDate: "2027-03-20", warehouseId: "wh-1", warehouseName: "Ana Depo", receivedAt: "2025-03-20" },
  { id: "lot-7", productId: "prod-1", productName: "Paracetamol 500mg", lotNumber: "LOT-2026-A01", quantity: 222, expiryDate: "2028-05-14", warehouseId: "wh-1", warehouseName: "Ana Depo", receivedAt: "2026-05-14" },
];

// ========================
// Suppliers
// ========================
export const demoSuppliers: Supplier[] = [
  { id: "sup-1", name: "MedPharma A.Ş.", contactPerson: "Ali Demir", email: "ali@medpharma.com", phone: "+90 312 555 0101", address: "Ankara, Çankaya", taxId: "1234567890", isActive: true, totalOrders: 45, createdAt: "2025-01-10" },
  { id: "sup-2", name: "VitaPlus Ltd.", contactPerson: "Zeynep Yıldız", email: "zeynep@vitaplus.com", phone: "+90 216 555 0202", address: "İstanbul, Kadıköy", taxId: "9876543210", isActive: true, totalOrders: 32, createdAt: "2025-02-15" },
  { id: "sup-3", name: "CleanTech Kimya", contactPerson: "Burak Şen", email: "burak@cleantech.com", phone: "+90 232 555 0303", address: "İzmir, Bornova", taxId: "5678901234", isActive: true, totalOrders: 18, createdAt: "2025-04-01" },
  { id: "sup-4", name: "BabyWorld Dağıtım", contactPerson: "Elif Ak", email: "elif@babyworld.com", phone: "+90 242 555 0404", address: "Antalya, Muratpaşa", taxId: "3456789012", isActive: false, totalOrders: 8, createdAt: "2025-06-20" },
];

// ========================
// Customers
// ========================
export const demoCustomers: Customer[] = [
  { id: "cust-1", name: "Sağlık Eczanesi", contactPerson: "Fatma Özkan", email: "fatma@saglikeczanesi.com", phone: "+90 312 444 0101", address: "Ankara, Kızılay", taxId: "1111111111", isActive: true, totalOrders: 67, createdAt: "2025-01-05" },
  { id: "cust-2", name: "Güneş Market", contactPerson: "Hasan Çelik", email: "hasan@gunesmarket.com", phone: "+90 216 444 0202", address: "İstanbul, Ümraniye", taxId: "2222222222", isActive: true, totalOrders: 42, createdAt: "2025-02-18" },
  { id: "cust-3", name: "Online Sağlık Mağazası", contactPerson: "Merve Tan", email: "merve@onlinesaglik.com", phone: "+90 532 444 0303", address: "İstanbul, Şişli", taxId: "3333333333", isActive: true, totalOrders: 89, createdAt: "2025-03-10" },
  { id: "cust-4", name: "Doğa Kozmetik", contactPerson: "Can Aydın", email: "can@dogakozmetik.com", phone: "+90 242 444 0404", address: "Antalya, Lara", taxId: "4444444444", isActive: true, totalOrders: 15, createdAt: "2025-07-01" },
];
