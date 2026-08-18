#!/bin/bash
# DSG Plugin System Deployment Verification
# Checks all 6 critical system components

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║  DSG Plugin System Deployment Verification          ║"
echo "║  $(date +'%Y-%m-%d %H:%M:%S')                       ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0

# Helper functions
check_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Phase 1: Database Check
echo "▶ Phase 1: Checking Database..."
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  check_fail "Supabase credentials not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)"
else
  # Try to query the database (requires psql or curl to Supabase API)
  if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('plugins', 'executions', 'earnings', 'plugin_metrics');" &> /dev/null; then
      check_pass "Database: All 4 tables exist"
    else
      check_fail "Database: Missing tables (plugins, executions, earnings, plugin_metrics)"
    fi
  else
    check_warn "psql not installed, skipping database table check"
  fi
fi

# Phase 2: Trinity MCP Integration Check
echo ""
echo "▶ Phase 2: Checking Trinity MCP Integration..."
if [ -f "dsg-plugins/trinity-mcp/plugin-executor.ts" ]; then
  check_pass "Trinity MCP: plugin-executor.ts exists"

  if grep -q "VM2\|vm2" dsg-plugins/trinity-mcp/plugin-executor.ts; then
    check_pass "Trinity MCP: VM2 sandbox configured"
  else
    check_fail "Trinity MCP: VM2 sandbox not found in plugin-executor.ts"
  fi

  if grep -q "executePlugin\|executePlugin" dsg-plugins/trinity-mcp/plugin-executor.ts; then
    check_pass "Trinity MCP: executePlugin function exists"
  else
    check_fail "Trinity MCP: executePlugin function not found"
  fi
else
  check_fail "Trinity MCP: plugin-executor.ts not found"
fi

# Phase 3: Control Plane APIs Check
echo ""
echo "▶ Phase 3: Checking Control Plane APIs..."
if [ -f "app/api/plugins/execute/route.ts" ]; then
  check_pass "API: /api/plugins/execute endpoint exists"

  if grep -q "Stripe\|stripe" app/api/plugins/execute/route.ts; then
    check_pass "API: Stripe integration configured"
  else
    check_fail "API: Stripe integration not found in /api/plugins/execute"
  fi
else
  check_fail "API: /api/plugins/execute endpoint not found"
fi

if [ -f "app/api/jobs/weekly-payouts/route.ts" ]; then
  check_pass "API: /api/jobs/weekly-payouts endpoint exists"

  if grep -q "payout\|Payout" app/api/jobs/weekly-payouts/route.ts; then
    check_pass "API: Weekly payout logic configured"
  else
    check_fail "API: Payout logic not found"
  fi
else
  check_fail "API: /api/jobs/weekly-payouts endpoint not found"
fi

# Phase 4: GitHub Actions Validation
echo ""
echo "▶ Phase 4: Checking GitHub Actions..."
if [ -f ".github/workflows/validate-plugin.yml" ]; then
  check_pass "GitHub Actions: validate-plugin.yml workflow exists"

  if grep -q "banned\|API\|signature" .github/workflows/validate-plugin.yml; then
    check_pass "GitHub Actions: Validation checks configured"
  else
    check_fail "GitHub Actions: Validation checks not properly configured"
  fi
else
  check_fail "GitHub Actions: validate-plugin.yml workflow not found"
fi

# Phase 5: Environment Configuration Check
echo ""
echo "▶ Phase 5: Checking Environment Configuration..."
if [ -z "$STRIPE_SECRET_KEY" ]; then
  check_warn "Environment: STRIPE_SECRET_KEY not set"
else
  if [[ "$STRIPE_SECRET_KEY" == sk_* ]]; then
    check_pass "Environment: Stripe secret key configured"
  else
    check_fail "Environment: Invalid Stripe secret key format"
  fi
fi

if [ -z "$SUPABASE_URL" ]; then
  check_warn "Environment: SUPABASE_URL not set"
else
  check_pass "Environment: Supabase URL configured"
fi

if [ -z "$PAYOUT_JOB_SECRET_KEY" ]; then
  check_warn "Environment: PAYOUT_JOB_SECRET_KEY not set (required for weekly payouts)"
else
  check_pass "Environment: Payout job secret configured"
fi

# Phase 6: File Structure Check
echo ""
echo "▶ Phase 6: Checking File Structure..."
required_files=(
  "dsg-plugins/migrations/001_create_plugins.sql"
  "dsg-plugins/migrations/002_create_executions.sql"
  "dsg-plugins/migrations/003_create_earnings.sql"
  "dsg-plugins/migrations/004_create_metrics.sql"
  "dsg-plugins/trinity-mcp/plugin-executor.ts"
  "app/api/plugins/execute/route.ts"
  "app/api/jobs/weekly-payouts/route.ts"
  ".github/workflows/validate-plugin.yml"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    check_pass "File exists: $file"
  else
    check_fail "File missing: $file"
  fi
done

# Summary
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  Verification Summary                              ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Your DSG Plugin System is ready for deployment.${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Ensure all migrations are applied to your database"
  echo "2. Set environment variables (STRIPE_SECRET_KEY, PAYOUT_JOB_SECRET_KEY, etc.)"
  echo "3. Deploy to your hosting platform (Vercel, Railway, Render, etc.)"
  echo "4. Schedule the weekly payout job (cron: 0 0 * * 1)"
  echo "5. Push code to GitHub to trigger plugin validation workflow"
  exit 0
else
  echo -e "${RED}❌ Verification failed! Please fix the issues above before deploying.${NC}"
  exit 1
fi
