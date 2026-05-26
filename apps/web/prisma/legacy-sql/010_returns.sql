-- ============================================
-- 010: Returns (RMA) workflow
-- Customer + supplier returns, with per-item condition + value.
-- ============================================

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('customer', 'supplier')),
  related_order_id UUID,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'received', 'rejected', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returns_company ON returns(company_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status) WHERE status != 'received';

CREATE TRIGGER returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_number TEXT,
  quantity NUMERIC(12,2) NOT NULL,
  condition TEXT NOT NULL DEFAULT 'resellable'
    CHECK (condition IN ('resellable', 'damaged', 'scrap')),
  unit_value NUMERIC(12,2)
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

-- RLS
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns_company" ON returns;
CREATE POLICY "returns_company" ON returns
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "return_items_company" ON return_items;
CREATE POLICY "return_items_company" ON return_items
  FOR ALL
  USING (
    return_id IN (
      SELECT id FROM returns
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    return_id IN (
      SELECT id FROM returns
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );
