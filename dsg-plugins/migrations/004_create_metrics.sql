-- Create plugin_metrics table (analytics & dashboard data)
CREATE TABLE IF NOT EXISTS plugin_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_executions INT DEFAULT 0,
  successful_executions INT DEFAULT 0,
  failed_executions INT DEFAULT 0,
  total_revenue_usd DECIMAL(10, 2) DEFAULT 0,
  avg_execution_time_ms INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(plugin_id, date)
);

-- Add RLS policies
ALTER TABLE plugin_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plugin_metrics_read_all" ON plugin_metrics
  FOR SELECT USING (TRUE);

CREATE POLICY "plugin_metrics_write_system" ON plugin_metrics
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "plugin_metrics_update_system" ON plugin_metrics
  FOR UPDATE USING (TRUE);

-- Create indexes
CREATE INDEX idx_plugin_metrics_plugin_id ON plugin_metrics(plugin_id);
CREATE INDEX idx_plugin_metrics_date ON plugin_metrics(date DESC);

-- View for dashboard (top plugins by revenue)
CREATE OR REPLACE VIEW plugin_metrics_dashboard AS
SELECT
  p.id,
  p.name,
  p.version,
  COUNT(e.id)::INT as total_executions,
  COUNT(CASE WHEN e.status = 'success' THEN 1 END)::INT as successful_executions,
  SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END)::INT as failed_executions,
  SUM(e.cost_usd)::DECIMAL as total_revenue_usd,
  AVG(CASE WHEN e.execution_time_ms IS NOT NULL THEN e.execution_time_ms ELSE 0 END)::INT as avg_execution_time_ms,
  (SUM(e.cost_usd) * 0.7)::DECIMAL as developer_payout_usd,
  (SUM(e.cost_usd) * 0.3)::DECIMAL as platform_revenue_usd
FROM plugins p
LEFT JOIN executions e ON p.id = e.plugin_id AND e.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name, p.version;
