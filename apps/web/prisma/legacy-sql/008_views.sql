-- ============================================
-- 008: Analytics views for Phase 2 (Smart Stock & Automation)
--   - v_reorder_suggestions  → /dashboard/reorder
--   - v_inventory_turnover   → Reports → "Devir Hızı" tab
--   - v_dead_stock           → /dashboard/reports/dead-stock
-- ABC analysis is computed in a server action (needs windowing per-company,
-- not a static view).
-- ============================================

-- 1) Reorder suggestions: products whose total stock has fallen to or below
--    min_stock. Picks the last supplier we bought from as preferred.
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
  /* Suggested order qty: top up to max_stock if known, else 2× min_stock. */
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

-- 2) Inventory turnover: out movements in last 30/60/90 days divided by
--    average stock. Higher = faster moving.
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

-- 3) Dead stock: products with stock > 0 but no out/transfer movement in
--    the last 90 days. The threshold is the default; the action layer can
--    re-derive it differently if needed.
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
