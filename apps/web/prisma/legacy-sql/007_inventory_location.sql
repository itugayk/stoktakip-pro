-- ============================================
-- 007: Inventory ↔ warehouse_locations link
-- Allows assigning stock to a specific bin/shelf, and scanning location QRs
-- to see what's there.
-- ============================================

-- The column already exists in 001_initial_schema.sql, but the index didn't.
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id) WHERE location_id IS NOT NULL;

-- Helpful view: stock per location.
CREATE OR REPLACE VIEW v_location_inventory AS
SELECT
  l.id AS location_id,
  l.warehouse_id,
  l.name AS location_name,
  l.description AS location_description,
  i.product_id,
  p.name AS product_name,
  p.sku AS product_sku,
  p.barcode AS product_barcode,
  p.unit AS product_unit,
  i.lot_number,
  i.expiry_date,
  SUM(i.quantity) AS quantity
FROM warehouse_locations l
LEFT JOIN inventory i ON i.location_id = l.id
LEFT JOIN products p ON p.id = i.product_id
GROUP BY l.id, l.warehouse_id, l.name, l.description, i.product_id, p.name, p.sku, p.barcode, p.unit, i.lot_number, i.expiry_date;
