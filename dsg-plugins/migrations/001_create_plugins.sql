-- Create plugins table (marketplace registry)
CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  version VARCHAR(50) NOT NULL,
  author_id UUID NOT NULL,
  description TEXT,
  code_hash VARCHAR(64) NOT NULL UNIQUE,
  rsa_signature VARCHAR(512) NOT NULL,
  cost_usd DECIMAL(10, 2) NOT NULL DEFAULT 0.01,
  cost_max_usd DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT cost_range CHECK (cost_usd > 0 AND cost_usd <= cost_max_usd)
);

-- Add RLS policies
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plugins_read_all" ON plugins
  FOR SELECT USING (TRUE);

CREATE POLICY "plugins_write_owner" ON plugins
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "plugins_update_owner" ON plugins
  FOR UPDATE USING (auth.uid() = author_id);

-- Create indexes
CREATE INDEX idx_plugins_author_id ON plugins(author_id);
CREATE INDEX idx_plugins_enabled ON plugins(enabled);
CREATE INDEX idx_plugins_created_at ON plugins(created_at DESC);
