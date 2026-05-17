// Barrel for snake_case ↔ camelCase mappers.
// Conventions:
//   toX(row)   : DB row → domain type (Product, Warehouse, ...)
//   fromX(p)   : domain partial → DB Insert partial (snake_case, nullable handling)
// Use these instead of inline mapping inside server actions.

export { toProduct, fromProduct, toProductWithStock } from "./product";
export { toCategory, fromCategory } from "./category";
export { toInventoryLot, fromInventoryLot, toExpiringLot } from "./inventory";
export type { ExpiringLot } from "./inventory";
export { toStockMovement, fromStockMovement } from "./movement";
export type { MovementJoinedRow } from "./movement";
export { toWarehouse, fromWarehouse } from "./warehouse";
export type { WarehouseJoinedRow } from "./warehouse";
export { toSupplier, fromSupplier } from "./supplier";
export { toCustomer, fromCustomer } from "./customer";
