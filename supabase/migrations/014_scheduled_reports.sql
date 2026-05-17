-- ============================================
-- 014: Scheduled reports
-- A row per "weekly snapshot to X@Y.com" job. A cron (Edge function or
-- Supabase pg_cron) iterates due rows and triggers the report build + email.
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('inventory', 'expiry', 'turnover', 'profit', 'sales_summary')),
  /** Stored in JSONB so each report type can carry its own filters. */
  params JSONB NOT NULL DEFAULT '{}',
  /** Frequency: daily / weekly / monthly. */
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  /** Day-of-week (0-6) for weekly, day-of-month (1-28) for monthly. */
  day_of_period INT,
  /** Local-time hour (0-23) to fire. */
  hour_of_day INT NOT NULL DEFAULT 8 CHECK (hour_of_day BETWEEN 0 AND 23),
  recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_company ON scheduled_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_due ON scheduled_reports(next_run_at) WHERE is_active = true;

CREATE TRIGGER scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_reports_company" ON scheduled_reports;
CREATE POLICY "scheduled_reports_company" ON scheduled_reports
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
