-- ============================================
-- 005: User favorites (per-user, per-entity)
-- Backs the star icons on list pages + dashboard "Favori Ürünler" widget.
-- ============================================

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'supplier', 'customer', 'warehouse')),
  entity_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_company ON user_favorites(company_id);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Users can read + write only their own favorites scoped to their company.
DROP POLICY IF EXISTS "favorites_own" ON user_favorites;
CREATE POLICY "favorites_own" ON user_favorites
  FOR ALL
  USING (
    user_id = auth.uid()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );
