-- Create executions table (execution history + billing)
CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cost_usd DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  result TEXT,
  error_message TEXT,
  execution_time_ms INT,
  stripe_charge_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'success', 'failed', 'error'))
);

-- Add RLS policies
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executions_read_own" ON executions
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = (SELECT author_id FROM plugins WHERE id = plugin_id));

CREATE POLICY "executions_write_system" ON executions
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "executions_update_system" ON executions
  FOR UPDATE USING (TRUE);

-- Create indexes
CREATE INDEX idx_executions_plugin_id ON executions(plugin_id);
CREATE INDEX idx_executions_user_id ON executions(user_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);
CREATE INDEX idx_executions_stripe_charge_id ON executions(stripe_charge_id);
