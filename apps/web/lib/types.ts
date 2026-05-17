// ========================
// Core Types
// ========================

export type UserRole = "admin" | "manager" | "warehouse_staff" | "viewer";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

// ========================
// Product Types
// ========================

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  categoryId: string;
  unit: string;
  minStock: number;
  maxStock: number;
  purchasePrice: number;
  salePrice: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductWithStock extends Product {
  currentStock: number;
  categoryName: string;
  stockStatus: "ok" | "low" | "critical" | "overstock";
}

// ========================
// Inventory Types
// ========================

export type MovementType = "in" | "out" | "transfer" | "adjustment";

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: MovementType;
  quantity: number;
  warehouseId: string;
  warehouseName: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  lotNumber?: string;
  expiryDate?: string;
  reason?: string;
  reference?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface InventoryLot {
  id: string;
  productId: string;
  productName: string;
  lotNumber: string;
  quantity: number;
  expiryDate?: string;
  warehouseId: string;
  warehouseName: string;
  receivedAt: string;
}

// ========================
// Warehouse Types
// ========================

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  managerId?: string;
  managerName?: string;
  isActive: boolean;
  totalProducts: number;
  totalQuantity: number;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  name: string; // e.g., "A-1-3" (Aisle-Rack-Shelf)
  description?: string;
}

// ========================
// Supplier & Customer Types
// ========================

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  isActive: boolean;
  totalOrders: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  isActive: boolean;
  totalOrders: number;
  createdAt: string;
}

// ========================
// Common Types
// ========================

export type UnitType = "adet" | "kg" | "lt" | "m" | "m2" | "kutu" | "paket" | "palet" | "koli";

export const UNITS: { value: UnitType; label: string }[] = [
  { value: "adet", label: "Adet" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "lt", label: "Litre (lt)" },
  { value: "m", label: "Metre (m)" },
  { value: "m2", label: "Metrekare (m²)" },
  { value: "kutu", label: "Kutu" },
  { value: "paket", label: "Paket" },
  { value: "palet", label: "Palet" },
  { value: "koli", label: "Koli" },
];
