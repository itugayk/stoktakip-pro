-- ============================================
-- 015: Collaboration primitives
--   - profiles.warehouse_ids[] (depo bazlı yetki)
--   - comments (yorum + @mention)
--   - tasks (görev atama)
--   - invitations (e-posta davet akışı)
--   - companies.subscription_limits JSONB (plan-based caps)
-- ============================================

-- Per-user accessible warehouses. NULL or empty = all warehouses of company.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS warehouse_ids UUID[];

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_limits JSONB NOT NULL DEFAULT '{}';

-- ============================================
-- COMMENTS — generic, attached to any entity by (entity_type, entity_id)
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'product', 'purchase_order', 'sales_order', 'count', 'return', 'task'
  )),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  mentions UUID[] DEFAULT NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_company ON comments(company_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_company" ON comments;
CREATE POLICY "comments_company" ON comments
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- TASKS — internal task tracker (assign + due date)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  /** Optional link to a domain object (e.g. PO, count). */
  entity_type TEXT CHECK (entity_type IS NULL OR entity_type IN (
    'product', 'purchase_order', 'sales_order', 'count', 'return'
  )),
  entity_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_at DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to) WHERE status != 'done';
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at) WHERE status != 'done' AND due_at IS NOT NULL;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_company" ON tasks;
CREATE POLICY "tasks_company" ON tasks
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- INVITATIONS — pending invites by email
-- ============================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'warehouse_staff', 'viewer')),
  warehouse_ids UUID[],
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_company" ON invitations;
CREATE POLICY "invitations_company" ON invitations
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
