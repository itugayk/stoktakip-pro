-- ============================================
-- 006: Stock counting (cycle counting)
-- Backs /dashboard/counts — scope-based counts → adjustment movement.
-- ============================================

CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT,                                  -- ör. "Mart 2026 Genel Sayım"
  scope JSONB NOT NULL DEFAULT '{}',           -- { categories: [...], locations: [...] }
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'review', 'closed', 'cancelled')),
  started_by UUID NOT NULL REFERENCES profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_company ON stock_counts(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_warehouse ON stock_counts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_status ON stock_counts(status) WHERE status != 'closed';

CREATE TRIGGER stock_counts_updated_at
  BEFORE UPDATE ON stock_counts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS stock_count_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_number TEXT,
  expected_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  counted_qty NUMERIC(12,2),                   -- NULL until scanned
  variance NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
  scanned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_count_items_count ON stock_count_items(count_id);
CREATE INDEX IF NOT EXISTS idx_count_items_product ON stock_count_items(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_count_items_unique
  ON stock_count_items(count_id, product_id, COALESCE(lot_number, ''));

-- RLS
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_counts_company" ON stock_counts;
CREATE POLICY "stock_counts_company" ON stock_counts
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "stock_count_items_company" ON stock_count_items;
CREATE POLICY "stock_count_items_company" ON stock_count_items
  FOR ALL
  USING (
    count_id IN (
      SELECT id FROM stock_counts
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    count_id IN (
      SELECT id FROM stock_counts
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );
