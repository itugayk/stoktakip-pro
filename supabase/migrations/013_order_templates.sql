-- ============================================
-- 013: Order templates
-- Save commonly-repeated PO / SO line sets and one-click create new orders.
-- ============================================

CREATE TABLE IF NOT EXISTS order_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'sales')),
  partner_id UUID,                        -- supplier_id for 'purchase', customer_id for 'sales'
  items JSONB NOT NULL DEFAULT '[]',      -- [{ product_id, quantity, unit_price }, ...]
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_templates_company ON order_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_order_templates_type ON order_templates(type);

CREATE TRIGGER order_templates_updated_at
  BEFORE UPDATE ON order_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE order_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_templates_company" ON order_templates;
CREATE POLICY "order_templates_company" ON order_templates
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- Sales order picking columns (PHASES 4.3)
-- ============================================
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS picked_qty NUMERIC(12,2) NOT NULL DEFAULT 0;
