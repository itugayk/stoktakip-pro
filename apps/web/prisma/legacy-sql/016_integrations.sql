-- ============================================
-- 016: Integrations — API keys, webhooks, provider connections
-- ============================================

-- ============================================
-- API KEYS — public REST API authentication
-- Token format: sk_live_<32-char-random>. We store only a SHA256 hash so the
-- raw token is shown exactly once (on creation). The "prefix" column lets
-- admins identify a key in the UI without revealing the full secret.
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,                      -- first 12 chars of token (for display)
  hashed_token TEXT NOT NULL UNIQUE,         -- SHA256(token)
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  created_by UUID NOT NULL REFERENCES profiles(id),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(hashed_token) WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys_company" ON api_keys;
CREATE POLICY "api_keys_company" ON api_keys
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- WEBHOOKS — outbound user-defined endpoints
-- Each webhook subscribes to one or more event types and receives an
-- HMAC-SHA256 signed POST when those events fire.
-- ============================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,                       -- shared HMAC secret
  events TEXT[] NOT NULL,                     -- e.g. ['stock.low','order.created']
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_company ON webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;

CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhooks_company" ON webhooks;
CREATE POLICY "webhooks_company" ON webhooks
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- WEBHOOK DELIVERIES — attempts log (debugging + retry)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  response_body TEXT,
  duration_ms INT,
  attempt INT NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed ON webhook_deliveries(webhook_id) WHERE success = false;

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_deliveries_company" ON webhook_deliveries;
CREATE POLICY "webhook_deliveries_company" ON webhook_deliveries
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- INTEGRATION CONNECTIONS — credentials + state per provider
-- Credentials live in `config` JSONB. In production, encrypt at rest via
-- supabase vault or a column-level encryption setup. For now, RLS plus the
-- company scope is the guard.
-- ============================================
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('marketplace', 'accounting', 'shipping', 'e_invoice', 'messaging')),
  provider TEXT NOT NULL,                     -- 'shopify','trendyol','parasut','aras','whatsapp_cloud',...
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'connecting', 'active', 'error')),
  config JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, name)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_company ON integration_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_category ON integration_connections(company_id, category);

CREATE TRIGGER integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integration_connections_company" ON integration_connections;
CREATE POLICY "integration_connections_company" ON integration_connections
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- SYNC JOBS — pending pulls/pushes (e.g. import orders from Shopify)
-- A worker (Edge function / pg_cron) drains rows in 'pending' status.
-- ============================================
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,                         -- e.g. 'pull_orders','push_inventory'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  payload JSONB DEFAULT '{}',
  result JSONB,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_pending ON sync_jobs(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sync_jobs_company ON sync_jobs(company_id, created_at DESC);

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_jobs_company" ON sync_jobs;
CREATE POLICY "sync_jobs_company" ON sync_jobs
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
