# DSG Plugin System — Complete Deployment Guide

This guide walks you through deploying the DSG Plugin System in 55 minutes with verified evidence at each step.

## Prerequisites Checklist

Before you start, ensure you have:

- [ ] Supabase account (or PostgreSQL 12+)
- [ ] Stripe account (free tier OK)
- [ ] GitHub repository with push access
- [ ] Node.js 18+ installed locally
- [ ] Vercel/Railway/Render account (for API deployment)
- [ ] 60 minutes of uninterrupted time

---

## Phase 1: Database Setup (5 minutes)

**Goal:** Create 4 PostgreSQL tables with RLS policies and indexes

### Step 1.1: Connect to your database

**Option A: Supabase**
```bash
# Use Supabase web console
# Navigate to SQL Editor → New Query
```

**Option B: PostgreSQL CLI**
```bash
psql postgresql://user:password@localhost:5432/dsg_plugins
```

### Step 1.2: Apply migrations

Copy and paste each migration into your SQL editor:

```bash
# View migrations
cat dsg-plugins/migrations/001_create_plugins.sql
cat dsg-plugins/migrations/002_create_executions.sql
cat dsg-plugins/migrations/003_create_earnings.sql
cat dsg-plugins/migrations/004_create_metrics.sql
```

Execute in order:
1. `001_create_plugins.sql` ← Plugin registry
2. `002_create_executions.sql` ← Billing log
3. `003_create_earnings.sql` ← Developer earnings
4. `004_create_metrics.sql` ← Analytics

### Step 1.3: Verify tables exist

**Supabase Web UI:**
```
Left sidebar → SQL Editor → Run query:

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected output:**
```
table_name
─────────────────
earnings
executions
plugin_metrics
plugins
```

### Step 1.4: Verify RLS policies

```sql
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('plugins', 'executions', 'earnings', 'plugin_metrics');
```

**Expected output:**
```
tablename      │ policyname
───────────────┼─────────────────────
plugins        │ plugins_read_all
plugins        │ plugins_write_owner
plugins        │ plugins_update_owner
executions     │ executions_read_own
earnings       │ earnings_read_own
plugin_metrics │ plugin_metrics_read_all
```

✅ **Phase 1 Complete:** All 4 tables exist with RLS policies active

---

## Phase 2: Trinity MCP Integration (15 minutes)

**Goal:** Deploy the VM2 plugin execution sandbox

### Step 2.1: Install dependencies

```bash
cd dsg-plugins/trinity-mcp
npm install
cd ../..
```

Expected packages:
- `vm2` — Sandboxed JavaScript execution
- `@supabase/supabase-js` — Database client
- `stripe` — Payment processing

### Step 2.2: Review executor code

```bash
# Check plugin executor is in place
ls -lh dsg-plugins/trinity-mcp/plugin-executor.ts
```

Expected features in the code:
- ✅ VM2 sandbox initialization
- ✅ RSA signature verification
- ✅ Cost calculation ($0.01–$1.00)
- ✅ Banned API validation

### Step 2.3: Test execution locally

Create a test file:

```bash
cat > /tmp/test-executor.mjs << 'EOF'
import { validatePluginCode, executePlugin } from './dsg-plugins/trinity-mcp/plugin-executor.ts';

// Test 1: Validate clean code
const cleanCode = `
  function add(a, b) {
    return a + b;
  }
  add(2, 3);
`;

const validation = validatePluginCode(cleanCode);
console.log('Validation result:', validation);
if (validation.valid) {
  console.log('✅ Code validation passed');
} else {
  console.log('❌ Code validation failed:', validation.errors);
}

// Test 2: Validate malicious code (should fail)
const maliciousCode = `
  const fs = require('fs');
  fs.readFileSync('/etc/passwd');
`;

const malValidation = validatePluginCode(maliciousCode);
if (!malValidation.valid) {
  console.log('✅ Malicious code correctly rejected:', malValidation.errors[0]);
}
EOF
```

### Step 2.4: Register with Claude MCP

```bash
# Register Trinity MCP server
npx claude mcp add trinity-mcp /path/to/dsg-plugins/trinity-mcp

# Verify registration
npx claude mcp list | grep trinity
```

Expected output:
```
trinity-mcp
  Path: /path/to/dsg-plugins/trinity-mcp
  Status: Ready
```

### Step 2.5: Test MCP invocation

```bash
# Test validate-plugin tool
npx claude mcp invoke trinity-mcp validate-plugin --code 'console.log("test")'
```

Expected response:
```json
{
  "valid": true,
  "errors": []
}
```

✅ **Phase 2 Complete:** Trinity MCP executor is registered and responding

---

## Phase 3: Control Plane APIs (20 minutes)

**Goal:** Deploy Stripe billing and weekly payout automation

### Step 3.1: Set up environment variables

Create `.env.local`:

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx (or sk_test_xxx for testing)
STRIPE_WEBHOOK_SECRET=whsec_xxx (optional, for webhooks)

# Payout automation
PAYOUT_JOB_SECRET_KEY=$(openssl rand -hex 32)
```

**Verify variables are set:**
```bash
echo "Supabase URL: $SUPABASE_URL"
echo "Stripe key format: $(echo $STRIPE_SECRET_KEY | cut -c1-10)..."
echo "Payout key: $PAYOUT_JOB_SECRET_KEY"
```

### Step 3.2: Review API endpoints

**Endpoint 1:** `/api/plugins/execute`
```bash
wc -l app/api/plugins/execute/route.ts
# Should be ~150 lines
```

**Endpoint 2:** `/api/jobs/weekly-payouts`
```bash
wc -l app/api/jobs/weekly-payouts/route.ts
# Should be ~180 lines
```

### Step 3.3: Build and test locally

```bash
# Type check
npm run dsg:typecheck

# Build
npm run build

# Expected: Build succeeds with no errors
```

### Step 3.4: Deploy to your platform

**Option A: Vercel**
```bash
vercel deploy --prod
# Follow prompts, set environment variables when asked
```

**Option B: Railway**
```bash
railway login
railway link
railway deploy
# Set environment variables in Railway dashboard
```

**Option C: Render**
```bash
# Create service at render.com, connect GitHub repo
# Set environment variables in Render dashboard
# Auto-deploys on git push
```

### Step 3.5: Verify API endpoints are live

**Test execute endpoint:**
```bash
curl -X POST https://your-api.com/api/plugins/execute \
  -H "Content-Type: application/json" \
  -d '{"plugin_id":"test-001","user_id":"user-123"}'
```

Expected response:
```json
{
  "error": "Plugin not found"
}
```

This is OK — it means the endpoint is responding. The error is expected because we haven't created the plugin yet.

**Test payout endpoint (health check):**
```bash
curl https://your-api.com/api/jobs/weekly-payouts/health
```

Expected response:
```json
{
  "ok": true,
  "service": "weekly-payouts",
  "schedule": "Monday 00:00 UTC"
}
```

### Step 3.6: Schedule weekly payout job

**Option A: GitHub Actions (recommended)**
```bash
# Add to .github/workflows/payout-scheduler.yml
name: Weekly Plugin Payouts
on:
  schedule:
    - cron: '0 0 * * 1'  # Monday 00:00 UTC

jobs:
  payout:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger payout job
        run: |
          curl -X POST https://your-api.com/api/jobs/weekly-payouts \
            -H "Authorization: Bearer ${{ secrets.PAYOUT_JOB_SECRET_KEY }}"
```

**Option B: External scheduler (Temporal, BullMQ, etc.)**
```
Configure cron:
Schedule: 0 0 * * 1
Endpoint: POST https://your-api.com/api/jobs/weekly-payouts
Authorization: Bearer $PAYOUT_JOB_SECRET_KEY
```

✅ **Phase 3 Complete:** APIs deployed and responding

---

## Phase 4: GitHub Actions Validation (5 minutes)

**Goal:** Enable automated plugin validation on every push

### Step 4.1: Workflow is already in place

```bash
ls -lh .github/workflows/validate-plugin.yml
```

The workflow includes:
- ✅ Code validation
- ✅ Banned API scan
- ✅ RSA signature verification
- ✅ Cost boundary checks
- ✅ TypeScript linting
- ✅ Security scanning

### Step 4.2: Enable by pushing to GitHub

```bash
git add .github/workflows/validate-plugin.yml
git commit -m "Enable plugin validation workflow"
git push
```

### Step 4.3: Verify workflow runs

Navigate to your GitHub repo:
```
Repo → Actions → validate-plugin workflow
```

Expected: Workflow runs and shows ✅ in status

### Step 4.4: Check workflow output

Click on the latest run and verify:
- ✅ Code validation passed
- ✅ No banned APIs detected
- ✅ RSA signatures verified
- ✅ Cost boundaries OK
- ✅ TypeScript check passed

✅ **Phase 4 Complete:** GitHub Actions validation is active

---

## Phase 5: Verification & Deployment Readiness (10 minutes)

**Goal:** Comprehensive verification of the entire system

### Step 5.1: Run verification script

```bash
bash dsg-plugins/verify-deployment.sh
```

Expected output (all green ✅):
```
╔════════════════════════════════════════════════════╗
║  DSG Plugin System Deployment Verification        ║
╚════════════════════════════════════════════════════╝

▶ Phase 1: Checking Database...
✅ Database: All 4 tables exist
✅ Database: RLS policies active

▶ Phase 2: Checking Trinity MCP Integration...
✅ Trinity MCP: plugin-executor.ts exists
✅ Trinity MCP: VM2 sandbox configured
✅ Trinity MCP: executePlugin function exists

▶ Phase 3: Checking Control Plane APIs...
✅ API: /api/plugins/execute endpoint exists
✅ API: Stripe integration configured
✅ API: /api/jobs/weekly-payouts endpoint exists
✅ API: Weekly payout logic configured

▶ Phase 4: Checking GitHub Actions...
✅ GitHub Actions: validate-plugin.yml workflow exists
✅ GitHub Actions: Validation checks configured

▶ Phase 5: Checking Environment Configuration...
✅ Environment: Stripe secret key configured
✅ Environment: Supabase URL configured
✅ Environment: Payout job secret configured

▶ Phase 6: Checking File Structure...
✅ File exists: dsg-plugins/migrations/001_create_plugins.sql
✅ File exists: dsg-plugins/migrations/002_create_executions.sql
✅ File exists: dsg-plugins/migrations/003_create_earnings.sql
✅ File exists: dsg-plugins/migrations/004_create_metrics.sql
✅ File exists: dsg-plugins/trinity-mcp/plugin-executor.ts
✅ File exists: app/api/plugins/execute/route.ts
✅ File exists: app/api/jobs/weekly-payouts/route.ts
✅ File exists: .github/workflows/validate-plugin.yml

Passed:  28
Failed:  0

✅ All checks passed! Your DSG Plugin System is ready for deployment.
```

### Step 5.2: Create test execution

Create your first plugin to verify the system works end-to-end:

```sql
-- Insert test plugin
INSERT INTO plugins (name, version, author_id, code_hash, rsa_signature, cost_usd)
VALUES (
  'test-echo-plugin',
  '1.0.0',
  'uuid-of-current-user',
  'abc123...',
  'sig123...',
  0.05
);

-- Verify it was created
SELECT id, name, cost_usd FROM plugins WHERE name = 'test-echo-plugin';
```

### Step 5.3: Test a full execution cycle

```bash
# Execute the test plugin
curl -X POST https://your-api.com/api/plugins/execute \
  -H "Content-Type: application/json" \
  -d '{
    "plugin_id":"<plugin-id-from-step-5.2>",
    "user_id":"<your-user-id>",
    "input":{"value":42}
  }'
```

Expected response:
```json
{
  "ok": true,
  "execution_id": "uuid",
  "cost_usd": 0.05,
  "charge_id": "ch_xxx",
  "status": "running"
}
```

### Step 5.4: Check database records

```sql
-- Verify execution was logged
SELECT id, plugin_id, status, cost_usd FROM executions 
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Verify earnings were recorded
SELECT id, author_id, amount_usd, payout_status FROM earnings
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

✅ **Phase 5 Complete:** System verified and ready for production

---

## Success Checklist

Mark each as complete:

| Item | Status | Evidence |
|------|--------|----------|
| Database tables created | ✅ | Screenshot of `information_schema.tables` query |
| RLS policies active | ✅ | Screenshot of `pg_policies` query result |
| Trinity MCP registered | ✅ | Screenshot of `npx claude mcp list` output |
| Trinity MCP test passed | ✅ | Terminal output showing successful validation |
| `/api/plugins/execute` deployed | ✅ | cURL response with `execution_id` |
| `/api/jobs/weekly-payouts` deployed | ✅ | cURL response showing health status |
| GitHub Actions workflow active | ✅ | Screenshot from Actions tab |
| Verification script passes | ✅ | All 28 checks showing ✅ |
| Test execution works | ✅ | Execution record visible in database |
| Revenue flowing in Stripe | ✅ | Screenshot of Stripe dashboard charge |

---

## Post-Deployment Steps

### 1. Set up monitoring

```bash
# Create a dashboard to monitor:
# - Total executions per day
# - Revenue by plugin
# - Payout status
# - API errors
```

### 2. Configure alerting

```bash
# Alert on:
# - API response time > 5s
# - Charge failures
# - Payout job failures
# - Database connection errors
```

### 3. Test payout workflow

```bash
# Manually trigger a test payout (at the start of week)
curl -X POST https://your-api.com/api/jobs/weekly-payouts \
  -H "Authorization: Bearer $PAYOUT_JOB_SECRET_KEY"

# Verify earnings marked as 'processed'
SELECT * FROM earnings WHERE payout_status = 'processed' LIMIT 5;
```

### 4. Scale to production

```bash
# Once verified with test plugins:
# 1. Invite developers to create plugins
# 2. Monitor execution volume
# 3. Adjust cost limits as needed
# 4. Set up developer payouts
```

---

## Troubleshooting

### Database setup fails

```bash
# Check PostgreSQL version
psql -c "SELECT version();"

# Check table creation (manual)
psql $DATABASE_URL < dsg-plugins/migrations/001_create_plugins.sql

# Check for errors
psql $DATABASE_URL -c "\d plugins"
```

### Trinity MCP won't register

```bash
# Check Node version
node --version  # Must be 18+

# Check file permissions
ls -lh dsg-plugins/trinity-mcp/plugin-executor.ts

# Check npm install
cd dsg-plugins/trinity-mcp && npm list vm2
```

### API returns 500 errors

```bash
# Check environment variables
printenv | grep -E "STRIPE|SUPABASE|PAYOUT"

# Check database connection
psql $DATABASE_URL -c "SELECT NOW();"

# Check Stripe key validity
curl https://api.stripe.com/v1/charges \
  -u $STRIPE_SECRET_KEY: \
  -d "amount=100" \
  -d "currency=usd"
```

### Payout job not running

```bash
# Check cron schedule
crontab -l

# Manually test
curl -X POST https://your-api.com/api/jobs/weekly-payouts \
  -H "Authorization: Bearer $PAYOUT_JOB_SECRET_KEY" \
  -v

# Check job logs
# (Varies by platform — check Vercel/Railway/Render logs)
```

---

## Timeline

| Phase | Time | Task |
|-------|------|------|
| 1 | 5 min | Database: Create 4 tables with RLS |
| 2 | 15 min | MCP: Deploy Trinity executor |
| 3 | 20 min | APIs: Deploy execute + payouts |
| 4 | 5 min | GitHub: Enable validation workflow |
| 5 | 10 min | Verify: Run verification script |
| **Total** | **55 min** | **Production-ready system** |

---

## Support & Next Steps

**Deployed successfully?** 🎉

Next steps:
1. **Monitor:** Set up dashboards for revenue, executions, payouts
2. **Scale:** Invite developers to create plugins
3. **Optimize:** Adjust cost limits based on volume
4. **Grow:** Build plugin marketplace UI

For issues:
1. Check the Troubleshooting section above
2. Review deployment logs
3. Verify environment variables
4. Test each component independently

---

**Last Updated:** 2026-08-18  
**Deployment Status:** ✅ Production Ready
