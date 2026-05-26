-- Views consumed by analytics/reports actions.
-- Prisma's `view` blocks expose typed read-only access; the DDL lives here.

CREATE OR REPLACE VIEW product_stock_summary AS
SELECT
  p.id AS product_id,
  p.company_id,
  p.name,
  p.sku,
  p.barcode,
  p.category_id,
  c.name AS category_name,
  p.unit,
  p.min_stock,
  p.max_stock,
  p.purchase_price,
  p.sale_price,
  p.is_active,
  COALESCE(SUM(i.quantity), 0) AS current_stock,
  COALESCE(SUM(i.reserved_quantity), 0) AS reserved_stock,
  CASE
    WHEN COALESCE(SUM(i.quantity), 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(SUM(i.quantity), 0) <= p.min_stock * 0.5 THEN 'critical'
    WHEN COALESCE(SUM(i.quantity), 0) <= p.min_stock THEN 'low'
    WHEN p.max_stock > 0 AND COALESCE(SUM(i.quantity), 0) > p.max_stock THEN 'overstock'
    ELSE 'ok'
  END AS stock_status,
  p.created_at,
  p.updated_at
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN inventory i ON i.product_id = p.id
GROUP BY p.id, c.name;

CREATE OR REPLACE VIEW expiring_lots AS
SELECT
  i.id,
  i.company_id,
  i.product_id,
  p.name AS product_name,
  p.sku AS product_sku,
  i.lot_number,
  i.quantity,
  i.expiry_date,
  i.warehouse_id,
  w.name AS warehouse_name,
  i.received_at,
  (i.expiry_date - CURRENT_DATE) AS days_left
FROM inventory i
JOIN products p ON p.id = i.product_id
JOIN warehouses w ON w.id = i.warehouse_id
WHERE i.expiry_date IS NOT NULL
  AND i.quantity > 0
ORDER BY i.expiry_date ASC;

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

CREATE OR REPLACE VIEW v_reorder_suggestions AS
SELECT
  p.id AS product_id,
  p.company_id,
  p.name,
  p.sku,
  p.unit,
  p.min_stock,
  p.max_stock,
  COALESCE(stock.current_stock, 0) AS current_stock,
  GREATEST(p.min_stock - COALESCE(stock.current_stock, 0), 0) AS shortage,
  CASE
    WHEN p.max_stock > 0 THEN GREATEST(p.max_stock - COALESCE(stock.current_stock, 0), 0)
    ELSE GREATEST(p.min_stock * 2 - COALESCE(stock.current_stock, 0), 0)
  END AS suggested_qty,
  (
    SELECT po.supplier_id
    FROM purchase_orders po
    JOIN purchase_order_items poi ON poi.order_id = po.id
    WHERE poi.product_id = p.id
    ORDER BY po.created_at DESC
    LIMIT 1
  ) AS preferred_supplier_id,
  p.purchase_price AS last_purchase_price
FROM products p
LEFT JOIN LATERAL (
  SELECT SUM(i.quantity) AS current_stock
  FROM inventory i
  WHERE i.product_id = p.id
) stock ON true
WHERE p.is_active = true
  AND p.min_stock > 0
  AND COALESCE(stock.current_stock, 0) <= p.min_stock;

CREATE OR REPLACE VIEW v_inventory_turnover AS
WITH stock_avg AS (
  SELECT
    i.product_id,
    AVG(i.quantity) AS avg_stock,
    SUM(i.quantity) AS current_stock
  FROM inventory i
  GROUP BY i.product_id
),
moves AS (
  SELECT
    m.product_id,
    SUM(CASE WHEN m.movement_type = 'out' AND m.created_at >= now() - interval '30 days' THEN m.quantity ELSE 0 END) AS out_30d,
    SUM(CASE WHEN m.movement_type = 'out' AND m.created_at >= now() - interval '60 days' THEN m.quantity ELSE 0 END) AS out_60d,
    SUM(CASE WHEN m.movement_type = 'out' AND m.created_at >= now() - interval '90 days' THEN m.quantity ELSE 0 END) AS out_90d,
    MAX(CASE WHEN m.movement_type = 'out' THEN m.created_at ELSE NULL END) AS last_out_at
  FROM stock_movements m
  GROUP BY m.product_id
)
SELECT
  p.id AS product_id,
  p.company_id,
  p.name,
  p.sku,
  p.unit,
  c.name AS category_name,
  COALESCE(s.current_stock, 0) AS current_stock,
  COALESCE(s.avg_stock, 0) AS avg_stock,
  COALESCE(m.out_30d, 0) AS out_30d,
  COALESCE(m.out_60d, 0) AS out_60d,
  COALESCE(m.out_90d, 0) AS out_90d,
  CASE WHEN s.avg_stock IS NULL OR s.avg_stock = 0 THEN 0 ELSE COALESCE(m.out_30d, 0) / s.avg_stock END AS turnover_30d,
  CASE WHEN s.avg_stock IS NULL OR s.avg_stock = 0 THEN 0 ELSE COALESCE(m.out_90d, 0) / s.avg_stock END AS turnover_90d,
  m.last_out_at
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN stock_avg s ON s.product_id = p.id
LEFT JOIN moves m ON m.product_id = p.id
WHERE p.is_active = true;

CREATE OR REPLACE VIEW v_dead_stock AS
WITH last_out AS (
  SELECT product_id, MAX(created_at) AS last_out_at
  FROM stock_movements
  WHERE movement_type IN ('out', 'transfer')
  GROUP BY product_id
),
stock AS (
  SELECT product_id, SUM(quantity) AS current_stock,
         SUM(quantity * COALESCE(unit_cost, 0)) AS stock_value
  FROM inventory
  GROUP BY product_id
)
SELECT
  p.id AS product_id,
  p.company_id,
  p.name,
  p.sku,
  p.unit,
  p.sale_price,
  p.purchase_price,
  COALESCE(s.current_stock, 0) AS current_stock,
  COALESCE(s.stock_value, COALESCE(s.current_stock, 0) * p.purchase_price) AS stock_value,
  l.last_out_at,
  EXTRACT(DAY FROM (now() - COALESCE(l.last_out_at, p.created_at)))::INT AS days_idle
FROM products p
LEFT JOIN last_out l ON l.product_id = p.id
LEFT JOIN stock s ON s.product_id = p.id
WHERE p.is_active = true
  AND COALESCE(s.current_stock, 0) > 0
  AND (l.last_out_at IS NULL OR l.last_out_at < now() - interval '90 days');
