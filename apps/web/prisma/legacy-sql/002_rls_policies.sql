-- ============================================
-- StokTakip Pro — Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper function: get current user's company_id
-- ============================================
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- COMPANY-SCOPED POLICIES (tenant isolation)
-- Users can only see/modify data from their own company
-- ============================================

-- Profiles
CREATE POLICY "Users can view profiles in their company"
  ON profiles FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() = 'admin');

-- Categories
CREATE POLICY "Company-scoped categories"
  ON categories FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins/managers can manage categories"
  ON categories FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- Products
CREATE POLICY "Company-scoped products read"
  ON products FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins/managers can manage products"
  ON products FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admins/managers can update products"
  ON products FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  USING (company_id = get_user_company_id() AND get_user_role() = 'admin');

-- Warehouses
CREATE POLICY "Company-scoped warehouses"
  ON warehouses FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can manage warehouses"
  ON warehouses FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- Warehouse Locations
CREATE POLICY "Company-scoped locations"
  ON warehouse_locations FOR SELECT
  USING (warehouse_id IN (SELECT id FROM warehouses WHERE company_id = get_user_company_id()));

CREATE POLICY "Admins can manage locations"
  ON warehouse_locations FOR ALL
  USING (warehouse_id IN (SELECT id FROM warehouses WHERE company_id = get_user_company_id()) AND get_user_role() IN ('admin', 'manager'));

-- Inventory
CREATE POLICY "Company-scoped inventory"
  ON inventory FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Staff+ can manage inventory"
  ON inventory FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'warehouse_staff'));

-- Stock Movements
CREATE POLICY "Company-scoped movements read"
  ON stock_movements FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Staff+ can create movements"
  ON stock_movements FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager', 'warehouse_staff'));

-- Suppliers
CREATE POLICY "Company-scoped suppliers"
  ON suppliers FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins/managers can manage suppliers"
  ON suppliers FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- Customers
CREATE POLICY "Company-scoped customers"
  ON customers FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins/managers can manage customers"
  ON customers FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- Purchase Orders
CREATE POLICY "Company-scoped purchase orders"
  ON purchase_orders FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins/managers can manage purchase orders"
  ON purchase_orders FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- Purchase Order Items
CREATE POLICY "Company-scoped purchase order items"
  ON purchase_order_items FOR SELECT
  USING (order_id IN (SELECT id FROM purchase_orders WHERE company_id = get_user_company_id()));

CREATE POLICY "Admins/managers can manage purchase order items"
  ON purchase_order_items FOR ALL
  USING (order_id IN (SELECT id FROM purchase_orders WHERE company_id = get_user_company_id()) AND get_user_role() IN ('admin', 'manager'));

-- Sales Orders
CREATE POLICY "Company-scoped sales orders"
  ON sales_orders FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins/managers can manage sales orders"
  ON sales_orders FOR ALL
  USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- Sales Order Items
CREATE POLICY "Company-scoped sales order items"
  ON sales_order_items FOR SELECT
  USING (order_id IN (SELECT id FROM sales_orders WHERE company_id = get_user_company_id()));

CREATE POLICY "Admins/managers can manage sales order items"
  ON sales_order_items FOR ALL
  USING (order_id IN (SELECT id FROM sales_orders WHERE company_id = get_user_company_id()) AND get_user_role() IN ('admin', 'manager'));

-- Notifications
CREATE POLICY "Users can see their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR (company_id = get_user_company_id() AND user_id IS NULL));

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Audit Log
CREATE POLICY "Admins can view audit log"
  ON audit_log FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() = 'admin');
