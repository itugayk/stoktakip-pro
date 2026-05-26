-- Daily SKT (son kullanma tarihi) rule evaluator.
-- Called from app via prisma.$queryRaw`SELECT run_expiry_rules()`.

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
      IF EXISTS (
        SELECT 1 FROM expiry_rule_fires
        WHERE rule_id = r.id AND inventory_id = l.inventory_id
      ) THEN
        CONTINUE;
      END IF;

      IF r.recipients IS NULL OR array_length(r.recipients, 1) IS NULL THEN
        FOR recipient_id IN
          SELECT id FROM users
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
