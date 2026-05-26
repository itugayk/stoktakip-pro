-- ============================================
-- 017: Performance — additional indexes informed by Phase 1-6 query patterns
--
-- Each index here corresponds to a known slow path:
--   - Movements listed by company + date range  → idx_movements_company_date
--   - Notifications fetched by user + is_read   → idx_notifications_user_read
--   - Audit log by table + record (Audit Trail) → idx_audit_table_record
--   - Inventory aggregated by product           → idx_inventory_product_qty
--   - Open orders by status                     → partial indexes per table
--   - Inactive product filter (most lists exclude inactive)
-- ============================================

-- Movements: list-page query is "WHERE company_id = ? ORDER BY created_at DESC LIMIT N"
CREATE INDEX IF NOT EXISTS idx_movements_company_date
  ON stock_movements(company_id, created_at DESC);

-- Notifications bell: "WHERE user_id = ? AND is_read = false" — head:true count
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read) WHERE is_read = false;

-- Audit Trail UI lookup: "WHERE table_name = ? AND record_id = ? ORDER BY created_at DESC"
CREATE INDEX IF NOT EXISTS idx_audit_table_record
  ON audit_log(table_name, record_id, created_at DESC);

-- Inventory aggregates: many views/actions sum quantity per product.
CREATE INDEX IF NOT EXISTS idx_inventory_product_qty
  ON inventory(product_id) INCLUDE (quantity, warehouse_id, lot_number);

-- Open purchase orders (operations dashboard, reorder, mal kabul list)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_open
  ON purchase_orders(company_id, status)
  WHERE status IN ('draft', 'pending', 'approved', 'partial');

-- Open sales orders
CREATE INDEX IF NOT EXISTS idx_sales_orders_open
  ON sales_orders(company_id, status)
  WHERE status IN ('draft', 'pending', 'approved', 'shipped');

-- Active product filter — most list pages filter by is_active=true
CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(company_id) WHERE is_active = true;

-- Active categories filter
CREATE INDEX IF NOT EXISTS idx_categories_active
  ON categories(company_id) WHERE is_active = true;

-- Webhook delivery debugging: "list latest for webhook"
-- (created index already exists in 016 — keeping a comment for completeness)

-- Sync jobs queue drain: pending rows by scheduled_for
-- (created in 016 — keeping a comment for completeness)

ANALYZE products;
ANALYZE inventory;
ANALYZE stock_movements;
ANALYZE notifications;
ANALYZE audit_log;
