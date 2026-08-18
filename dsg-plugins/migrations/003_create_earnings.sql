-- Create earnings table (developer payouts tracking)
CREATE TABLE IF NOT EXISTS earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  amount_usd DECIMAL(10, 2) NOT NULL,
  payout_status VARCHAR(50) DEFAULT 'pending',
  payout_id VARCHAR(255),
  payout_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_payout_status CHECK (payout_status IN ('pending', 'processed', 'failed', 'cancelled'))
);

-- Add RLS policies
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "earnings_read_own" ON earnings
  FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "earnings_write_system" ON earnings
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "earnings_update_system" ON earnings
  FOR UPDATE USING (TRUE);

-- Create indexes
CREATE INDEX idx_earnings_author_id ON earnings(author_id);
CREATE INDEX idx_earnings_plugin_id ON earnings(plugin_id);
CREATE INDEX idx_earnings_payout_status ON earnings(payout_status);
CREATE INDEX idx_earnings_created_at ON earnings(created_at DESC);
CREATE INDEX idx_earnings_payout_date ON earnings(payout_date DESC);

-- View for payout aggregation (weekly summary)
CREATE OR REPLACE VIEW earnings_weekly_summary AS
SELECT
  author_id,
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(*) as execution_count,
  SUM(amount_usd) as total_amount_usd
FROM earnings
WHERE payout_status = 'pending'
GROUP BY author_id, DATE_TRUNC('week', created_at);
