# DSG Plugin System — Complete End-to-End Deployment

A production-ready plugin marketplace with sandboxed execution, automated billing via Stripe, and weekly developer payouts.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DSG Plugin System                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Database Layer (PostgreSQL / Supabase)                 │
│     ├─ plugins (registry)                                  │
│     ├─ executions (billing log)                            │
│     ├─ earnings (developer earnings)                       │
│     └─ plugin_metrics (analytics)                          │
│                                                             │
│  2. Execution Layer (Trinity MCP + VM2)                    │
│     ├─ Sandboxed plugin execution                          │
│     ├─ RSA signature verification                          │
│     ├─ Cost tracking per execution                         │
│     └─ Banned API detection                                │
│                                                             │
│  3. Billing Layer (Stripe)                                 │
│     ├─ /api/plugins/execute (charge user)                  │
│     └─ /api/jobs/weekly-payouts (distribute revenue)       │
│                                                             │
│  4. Validation Layer (GitHub Actions)                      │
│     ├─ RSA signature verification                          │
│     ├─ Banned API scan                                     │
│     ├─ Cost boundary validation                            │
│     └─ Security scanning                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start (55 minutes)

### Phase 1: Database Setup (5 min)

Apply migrations to your Supabase project or PostgreSQL instance:

```bash
# Option 1: Supabase CLI
supabase migration up

# Option 2: psql
psql $DATABASE_URL < migrations/001_create_plugins.sql
psql $DATABASE_URL < migrations/002_create_executions.sql
psql $DATABASE_URL < migrations/003_create_earnings.sql
psql $DATABASE_URL < migrations/004_create_metrics.sql
```

**Verify:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should show: earnings, executions, plugin_metrics, plugins
```

### Phase 2: Trinity MCP Integration (15 min)

Install dependencies and register the plugin executor:

```bash
cd dsg-plugins/trinity-mcp
npm install

# Register with Claude
npx claude mcp add trinity-mcp /path/to/dsg-plugins/trinity-mcp
```

**Test execution:**
```bash
npx claude mcp invoke trinity-mcp validate-plugin --code 'console.log("test")'
```

### Phase 3: Control Plane APIs (20 min)

Deploy the two critical endpoints:

1. **Execute endpoint** (`app/api/plugins/execute/route.ts`)
   - Charges user via Stripe
   - Logs execution to database
   - Returns `execution_id` + `cost_usd`

2. **Payout endpoint** (`app/api/jobs/weekly-payouts/route.ts`)
   - Runs Monday 00:00 UTC
   - Distributes 70% of revenue to developers
   - Sends payout notifications

**Set environment variables:**
```bash
export STRIPE_SECRET_KEY=sk_live_...
export SUPABASE_URL=https://...supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...
export PAYOUT_JOB_SECRET_KEY=$(openssl rand -hex 32)
```

**Deploy:**
```bash
# Option 1: Vercel
vercel deploy

# Option 2: Railway
railway deploy

# Option 3: Render
render deploy
```

### Phase 4: GitHub Actions (5 min)

Push to enable plugin validation:

```bash
git add .github/workflows/validate-plugin.yml
git commit -m "Enable plugin validation"
git push
```

The workflow will:
- ✅ Verify RSA signatures
- ✅ Scan for banned APIs
- ✅ Check cost boundaries ($0.01–$1.00)
- ✅ Run security scans

### Phase 5: Verification (10 min)

Run the comprehensive verification script:

```bash
bash dsg-plugins/verify-deployment.sh
```

Expected output:
```
╔════════════════════════════════════════════════════╗
║  DSG Plugin System Deployment Verification          ║
╚════════════════════════════════════════════════════╝

✅ Passed:  28
❌ Failed:  0

✅ All checks passed! Your DSG Plugin System is ready for deployment.
```

---

## API Documentation

### Execute Plugin

**Endpoint:** `POST /api/plugins/execute`

**Request:**
```json
{
  "plugin_id": "uuid",
  "user_id": "uuid",
  "input": { "key": "value" }
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "execution_id": "uuid",
  "cost_usd": 0.05,
  "charge_id": "ch_xxx",
  "status": "running"
}
```

**Response (402 Payment Required):**
```json
{
  "error": "Payment failed",
  "details": "Your card was declined"
}
```

---

### Check Execution Status

**Endpoint:** `GET /api/plugins/execute?execution_id=uuid`

**Response (200 OK):**
```json
{
  "ok": true,
  "execution_id": "uuid",
  "status": "success",
  "result": { "output": "value" },
  "cost_usd": 0.05,
  "execution_time_ms": 234
}
```

---

### Weekly Payouts

**Endpoint:** `POST /api/jobs/weekly-payouts`

**Authorization:** `Authorization: Bearer $PAYOUT_JOB_SECRET_KEY`

**Response (200 OK):**
```json
{
  "ok": true,
  "payouts_processed": 42,
  "total_amount_usd": 1250.00,
  "successful": 42,
  "failed": 0
}
```

**Schedule via cron:**
```bash
# GitHub Actions (add to cron workflow)
schedule:
  - cron: '0 0 * * 1'  # Monday 00:00 UTC

# Railway
CRON_JOB: 'Monday 00:00 UTC -> POST /api/jobs/weekly-payouts'

# Alternative: Use external scheduler (Temporal, BullMQ, etc.)
```

---

## File Structure

```
dsg-plugins/
├── migrations/
│   ├── 001_create_plugins.sql
│   ├── 002_create_executions.sql
│   ├── 003_create_earnings.sql
│   └── 004_create_metrics.sql
├── trinity-mcp/
│   └── plugin-executor.ts
├── control-plane/
│   ├── api/
│   │   └── (execute endpoints deployed to app/api/plugins/execute)
│   └── jobs/
│       └── (payout job deployed to app/api/jobs/weekly-payouts)
├── verify-deployment.sh
└── README.md

app/api/
├── plugins/
│   └── execute/
│       └── route.ts
└── jobs/
    └── weekly-payouts/
        └── route.ts

.github/workflows/
└── validate-plugin.yml
```

---

## Database Schema

### plugins table

```sql
CREATE TABLE plugins (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  version VARCHAR(50),
  author_id UUID NOT NULL,
  code_hash VARCHAR(64) UNIQUE,
  rsa_signature VARCHAR(512),
  cost_usd DECIMAL(10, 2) DEFAULT 0.01,
  cost_max_usd DECIMAL(10, 2) DEFAULT 1.00,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### executions table

```sql
CREATE TABLE executions (
  id UUID PRIMARY KEY,
  plugin_id UUID REFERENCES plugins(id),
  user_id UUID NOT NULL,
  cost_usd DECIMAL(10, 2),
  status VARCHAR(50), -- pending|running|success|failed|error
  result TEXT,
  error_message TEXT,
  execution_time_ms INT,
  stripe_charge_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### earnings table

```sql
CREATE TABLE earnings (
  id UUID PRIMARY KEY,
  plugin_id UUID REFERENCES plugins(id),
  author_id UUID NOT NULL,
  execution_id UUID REFERENCES executions(id),
  amount_usd DECIMAL(10, 2),
  payout_status VARCHAR(50), -- pending|processed|failed
  payout_id VARCHAR(255),
  payout_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### plugin_metrics table

```sql
CREATE TABLE plugin_metrics (
  id UUID PRIMARY KEY,
  plugin_id UUID REFERENCES plugins(id),
  date DATE,
  total_executions INT,
  successful_executions INT,
  failed_executions INT,
  total_revenue_usd DECIMAL(10, 2),
  avg_execution_time_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Security & Compliance

### Plugin Sandboxing
- **Runtime:** VM2 (isolated JavaScript sandbox)
- **Banned APIs:** `require()`, `eval()`, `fs.*`, `process.*`, `child_process`
- **Timeout:** 30 seconds per execution
- **Memory:** Limited to 128MB per execution

### Code Verification
- **RSA Signatures:** All plugins must be signed
- **Git Validation:** GitHub Actions verifies on every push
- **Signature Check:** Plugins rejected if signature doesn't match code

### Payment Security
- **PCI Compliance:** Stripe handles all card data (no secrets stored)
- **Encryption:** All API calls use TLS 1.2+
- **Rate Limiting:** 100 executions/minute per user (configurable)

### Data Privacy
- **RLS Policies:** Users only see their own executions
- **Developer Privacy:** Earnings scoped to author
- **Audit Logs:** All transactions logged and immutable

---

## Monitoring & Analytics

### Dashboard Views

**plugin_metrics_dashboard** — Top plugins by revenue
```sql
SELECT * FROM plugin_metrics_dashboard 
ORDER BY total_revenue_usd DESC 
LIMIT 10;
```

**earnings_weekly_summary** — Weekly payout aggregates
```sql
SELECT * FROM earnings_weekly_summary
WHERE week_start >= NOW() - INTERVAL '4 weeks';
```

---

## Troubleshooting

### Database issues
```bash
# Check table existence
psql $DATABASE_URL -c "\d plugins"

# Check RLS policies
psql $DATABASE_URL -c "SELECT * FROM pg_policies WHERE tablename = 'plugins';"
```

### Stripe errors
```bash
# Check API key format
echo $STRIPE_SECRET_KEY  # Should start with "sk_live_" or "sk_test_"

# Test charge
curl https://api.stripe.com/v1/charges \
  -u $STRIPE_SECRET_KEY: \
  -d "amount=100" \
  -d "currency=usd" \
  -d "customer=cus_xxx"
```

### Payout job not running
```bash
# Verify cron schedule
crontab -l

# Manual trigger (for testing)
curl -X POST https://your-api.com/api/jobs/weekly-payouts \
  -H "Authorization: Bearer $PAYOUT_JOB_SECRET_KEY"
```

---

## Production Deployment Checklist

- [ ] All 4 database migrations applied
- [ ] Trinity MCP executor tested locally
- [ ] Environment variables set (Stripe, Supabase, Payout key)
- [ ] `/api/plugins/execute` deployed and responding
- [ ] `/api/jobs/weekly-payouts` deployed and accessible
- [ ] Cron job scheduled for Monday 00:00 UTC
- [ ] GitHub Actions workflow triggering on pushes
- [ ] Verification script passing all checks
- [ ] Stripe webhooks configured (optional but recommended)
- [ ] Monitoring/alerting set up for API errors
- [ ] Database backups configured
- [ ] Rate limiting policies in place

---

## Next Steps

1. **Deploy:** Follow Phase 1-5 above
2. **Monitor:** Set up dashboards for executions, revenue, payouts
3. **Scale:** Add more plugins, increase cost limits as volume grows
4. **Integrate:** Connect billing dashboard, developer portal, etc.
5. **Automate:** Set up Slack notifications for payouts, errors, etc.

---

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review deployment logs: `dsg-plugins/verify-deployment.sh`
3. Test each phase independently
4. Verify environment variables are set correctly

---

## Estimated Costs

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Supabase (free tier) | $0 | Database, RLS, auth |
| Stripe (% per transaction) | Variable | 2.9% + $0.30 per charge |
| API Runtime (Vercel/Railway) | $0–50 | Depends on execution volume |
| **Total** | **$0–50/month** | Scales with revenue |

---

## Revenue Model

| Charge | Amount | Split |
|--------|--------|-------|
| Plugin execution | $0.01–$1.00 | |
| Developer share | 70% | Weekly auto-payout |
| Platform share | 30% | DSG platform |

Example: If plugin executes 1,000 times at $0.10/execution:
- **Total revenue:** $100
- **Developer payout:** $70 (70%)
- **Platform revenue:** $30 (30%)

---

## Version History

- **1.0.0** (2026-08-18) — Initial production release
  - Database with RLS policies
  - Trinity MCP sandbox executor
  - Stripe billing integration
  - Weekly payout automation
  - GitHub Actions validation
  - Comprehensive verification script

---

**Last Updated:** 2026-08-18  
**Status:** Production Ready ✅
