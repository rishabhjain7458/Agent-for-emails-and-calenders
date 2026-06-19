CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'x', 'reddit')),
  provider_account_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, platform, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_user ON social_connections(tenant_id, user_id, platform);
