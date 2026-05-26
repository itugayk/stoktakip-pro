-- ============================================
-- 012: Multi-currency on orders + product VAT
-- products.tax_rate already exists (in 001) with default 18; we keep that.
-- Add currency/exchange_rate on PO + SO so the UI can show TRY-equivalent
-- side-by-side with the order currency.
-- ============================================

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) NOT NULL DEFAULT 1;

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,6) NOT NULL DEFAULT 1;
