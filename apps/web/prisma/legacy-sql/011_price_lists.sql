-- ============================================
-- 011: Price lists
-- Multiple lists per company, scoped to customer/supplier/tag with a
-- validity window. Order forms resolve the best applicable list.
-- ============================================

CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'customer', 'supplier', 'tag')),
  applies_to_id UUID,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_lists_company ON price_lists(company_id);
CREATE INDEX IF NOT EXISTS idx_price_lists_scope ON price_lists(applies_to, applies_to_id);

CREATE TRIGGER price_lists_updated_at
  BEFORE UPDATE ON price_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS price_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  min_qty NUMERIC(12,2) NOT NULL DEFAULT 1,
  UNIQUE (price_list_id, product_id, min_qty)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product ON price_list_items(product_id);

ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_lists_company" ON price_lists;
CREATE POLICY "price_lists_company" ON price_lists
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "price_list_items_company" ON price_list_items;
CREATE POLICY "price_list_items_company" ON price_list_items
  FOR ALL
  USING (
    price_list_id IN (
      SELECT id FROM price_lists
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    price_list_id IN (
      SELECT id FROM price_lists
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );
