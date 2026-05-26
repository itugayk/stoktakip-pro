-- ============================================
-- 009: Expiry (SKT) rule engine + per-user notification preferences
-- Daily cron evaluates expiring_lots against company rules → notifications.
-- ============================================

-- Per-user preferences (notification channels, etc.). JSONB so the shape can
-- evolve without follow-up migrations.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS expiry_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_days INT NOT NULL CHECK (trigger_days > 0),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,  -- NULL = all categories
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],              -- 'in_app','email','push','whatsapp'
  recipients UUID[] DEFAULT NULL,                                -- profile ids; null = all admin+manager
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expiry_rules_company ON expiry_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_expiry_rules_active ON expiry_rules(is_active) WHERE is_active = true;

CREATE TRIGGER expiry_rules_updated_at
  BEFORE UPDATE ON expiry_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE expiry_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expiry_rules_company" ON expiry_rules;
CREATE POLICY "expiry_rules_company" ON expiry_rules
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- Stored evaluator: idempotent — call once per day from cron.
-- Creates notifications for lots that just crossed a rule's trigger_days
-- threshold; doesn't re-notify the same lot+rule.
-- ============================================

CREATE TABLE IF NOT EXISTS expiry_rule_fires (
  rule_id UUID NOT NULL REFERENCES expiry_rules(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, inventory_id)
);

CREATE OR REPLACE FUNCTION run_expiry_rules() RETURNS INT AS $$
DECLARE
  fired_count INT := 0;
  r RECORD;
  l RECORD;
  recipient_id UUID;
BEGIN
  FOR r IN
    SELECT * FROM expiry_rules WHERE is_active = true
  LOOP
    FOR l IN
      SELECT i.id AS inventory_id, i.company_id, i.product_id, i.lot_number,
             i.quantity, i.expiry_date, p.name AS product_name,
             (i.expiry_date - CURRENT_DATE) AS days_left
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.company_id = r.company_id
        AND i.expiry_date IS NOT NULL
        AND i.quantity > 0
        AND (i.expiry_date - CURRENT_DATE) <= r.trigger_days
        AND (i.expiry_date - CURRENT_DATE) > 0
        AND (r.category_id IS NULL OR p.category_id = r.category_id)
    LOOP
      -- Skip if we've already fired for this (rule, lot).
      IF EXISTS (
        SELECT 1 FROM expiry_rule_fires
        WHERE rule_id = r.id AND inventory_id = l.inventory_id
      ) THEN
        CONTINUE;
      END IF;

      -- Pick recipients: explicit list, or all admin/manager profiles.
      IF r.recipients IS NULL OR array_length(r.recipients, 1) IS NULL THEN
        FOR recipient_id IN
          SELECT id FROM profiles
          WHERE company_id = r.company_id AND role IN ('admin', 'manager') AND is_active = true
        LOOP
          INSERT INTO notifications (company_id, user_id, type, title, message, metadata)
          VALUES (
            r.company_id, recipient_id, 'expiry_warning',
            'SKT Yaklaşıyor: ' || l.product_name,
            l.lot_number || ' lotu için ' || l.days_left || ' gün kaldı (' || l.quantity || ' adet)',
            jsonb_build_object(
              'productId', l.product_id,
              'inventoryId', l.inventory_id,
              'daysLeft', l.days_left,
              'ruleId', r.id
            )
          );
        END LOOP;
      ELSE
        FOREACH recipient_id IN ARRAY r.recipients
        LOOP
          INSERT INTO notifications (company_id, user_id, type, title, message, metadata)
          VALUES (
            r.company_id, recipient_id, 'expiry_warning',
            'SKT Yaklaşıyor: ' || l.product_name,
            l.lot_number || ' lotu için ' || l.days_left || ' gün kaldı (' || l.quantity || ' adet)',
            jsonb_build_object(
              'productId', l.product_id,
              'inventoryId', l.inventory_id,
              'daysLeft', l.days_left,
              'ruleId', r.id
            )
          );
        END LOOP;
      END IF;

      INSERT INTO expiry_rule_fires (rule_id, inventory_id) VALUES (r.id, l.inventory_id);
      fired_count := fired_count + 1;
    END LOOP;

    UPDATE expiry_rules SET last_run_at = now() WHERE id = r.id;
  END LOOP;

  RETURN fired_count;
END;
$$ LANGUAGE plpgsql;
