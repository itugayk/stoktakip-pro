-- ============================================
-- 004: Trigram search indexes for global search
-- Used by lib/actions/search.ts (searchEverything).
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Products: name, sku, barcode
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
  ON products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_barcode_trgm
  ON products USING gin (barcode gin_trgm_ops) WHERE barcode IS NOT NULL;

-- Suppliers + customers: name only (contact + tax info kept exact)
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
  ON suppliers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops);
