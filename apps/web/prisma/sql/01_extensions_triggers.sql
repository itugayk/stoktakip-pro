-- Extra DDL Prisma cannot express in schema.prisma.
-- Applied via a raw migration after `prisma migrate dev`.

-- ============================================
-- updated_at trigger function (shared)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table with an updated_at column.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'companies', 'users', 'categories', 'products',
    'warehouses', 'inventory', 'suppliers', 'customers',
    'purchase_orders', 'sales_orders', 'stock_counts',
    'expiry_rules', 'returns', 'price_lists', 'order_templates',
    'scheduled_reports', 'tasks', 'webhooks', 'integration_connections'
  ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END $$;

-- ============================================
-- Partial indexes (Prisma cannot express WHERE clauses)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inventory_expiry
  ON inventory(expiry_date) WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_lot
  ON inventory(lot_number) WHERE lot_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_location
  ON inventory(location_id) WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_counts_status_open
  ON stock_counts(status) WHERE status != 'closed';

CREATE INDEX IF NOT EXISTS idx_expiry_rules_active
  ON expiry_rules(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_returns_status_open
  ON returns(status) WHERE status != 'received';

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_open
  ON tasks(assigned_to) WHERE status != 'done';

CREATE INDEX IF NOT EXISTS idx_tasks_due_open
  ON tasks(due_at) WHERE status != 'done' AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_active
  ON api_keys(hashed_token) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhooks_active
  ON webhooks(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed
  ON webhook_deliveries(webhook_id) WHERE success = false;

CREATE INDEX IF NOT EXISTS idx_sync_jobs_pending
  ON sync_jobs(scheduled_for) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_unread
  ON notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_open
  ON purchase_orders(company_id, status)
  WHERE status IN ('draft', 'pending', 'approved', 'partial');

CREATE INDEX IF NOT EXISTS idx_sales_orders_open
  ON sales_orders(company_id, status)
  WHERE status IN ('draft', 'pending', 'approved', 'shipped');

CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(company_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_categories_active
  ON categories(company_id) WHERE is_active = true;

-- INCLUDE-column index for inventory aggregates
CREATE INDEX IF NOT EXISTS idx_inventory_product_qty
  ON inventory(product_id) INCLUDE (quantity, warehouse_id, lot_number);

-- ============================================
-- Generated column: stock_count_items.variance
-- ============================================
ALTER TABLE stock_count_items
  ADD COLUMN IF NOT EXISTS variance NUMERIC(12,2)
  GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED;

-- Composite uniqueness for stock_count_items including NULL lot_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_count_items_unique
  ON stock_count_items(count_id, product_id, COALESCE(lot_number, ''));
