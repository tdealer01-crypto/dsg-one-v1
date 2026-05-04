#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-}"
WORKSPACE_ID="${DSG_SMOKE_WORKSPACE_ID:-runtime-proof-workspace}"
ACTOR_ID="${DSG_SMOKE_ACTOR_ID:-memory-smoke-operator}"
ACTOR_ROLE="${DSG_SMOKE_ACTOR_ROLE:-operator}"

if [ -z "$APP_URL" ]; then
  echo "BLOCK: APP_URL is required" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PERMISSIONS="memory:write,memory:read,memory:gate,memory:context_pack"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RAW_TEXT="DSG One governed memory smoke. Memory must not override evidence. Timestamp: $NOW"
CONTENT_HASH="$(node -e "const crypto=require('crypto'); process.stdout.write(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" "$RAW_TEXT")"

request_json() {
  local method="$1"
  local url="$2"
  local payload_file="${3:-}"
  local output_file="$4"
  local status_file="$5"

  if [ -n "$payload_file" ]; then
    curl -sS -X "$method" "$url" \
      -H "content-type: application/json" \
      -H "x-dsg-workspace-id: $WORKSPACE_ID" \
      -H "x-dsg-actor-id: $ACTOR_ID" \
      -H "x-dsg-actor-role: $ACTOR_ROLE" \
      -H "x-dsg-permissions: $PERMISSIONS" \
      --data-binary "@$payload_file" \
      -o "$output_file" \
      -w "%{http_code}" > "$status_file"
  else
    curl -sS -X "$method" "$url" \
      -H "x-dsg-workspace-id: $WORKSPACE_ID" \
      -H "x-dsg-actor-id: $ACTOR_ID" \
      -H "x-dsg-actor-role: $ACTOR_ROLE" \
      -H "x-dsg-permissions: $PERMISSIONS" \
      -o "$output_file" \
      -w "%{http_code}" > "$status_file"
  fi
}

assert_ok_response() {
  local label="$1"
  local response_file="$2"
  local status_file="$3"
  local status
  status="$(cat "$status_file")"

  if [[ "$status" != 2* ]]; then
    echo "BLOCK: $label returned HTTP $status" >&2
    cat "$response_file" >&2
    exit 1
  fi

  node - "$response_file" "$label" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const label = process.argv[3];
const body = JSON.parse(fs.readFileSync(file, 'utf8'));
if (body.ok !== true) {
  console.error(`BLOCK: ${label} did not return ok=true`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}
if (!body.boundary || body.boundary.productionReadyClaim !== false) {
  console.error(`BLOCK: ${label} missing non-production boundary`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}
NODE
}

cat > "$TMP_DIR/ingest.json" <<JSON
{
  "sourceType": "manual_note",
  "memoryKind": "policy",
  "rawText": "$RAW_TEXT",
  "trustLevel": "user_supplied",
  "status": "active",
  "containsSecret": false,
  "containsPii": false,
  "containsLegalClaim": false,
  "containsProductionClaim": false,
  "contentHash": "$CONTENT_HASH",
  "metadata": {
    "smoke": true,
    "repo": "dsg-one-v1",
    "timestamp": "$NOW"
  }
}
JSON

request_json POST "$APP_URL/api/dsg/memory/ingest" "$TMP_DIR/ingest.json" "$TMP_DIR/ingest.response.json" "$TMP_DIR/ingest.status"
assert_ok_response "memory ingest" "$TMP_DIR/ingest.response.json" "$TMP_DIR/ingest.status"

node - "$TMP_DIR/ingest.response.json" > "$TMP_DIR/memory.json" <<'NODE'
const fs = require('fs');
const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!body.memory || !body.memory.id) {
  console.error('BLOCK: ingest response missing memory.id');
  process.exit(1);
}
process.stdout.write(JSON.stringify(body.memory));
NODE

SEARCH_URL="$APP_URL/api/dsg/memory/search?q=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "DSG One governed memory smoke")&limit=5"
request_json GET "$SEARCH_URL" "" "$TMP_DIR/search.response.json" "$TMP_DIR/search.status"
assert_ok_response "memory search" "$TMP_DIR/search.response.json" "$TMP_DIR/search.status"

node - "$TMP_DIR/search.response.json" <<'NODE'
const fs = require('fs');
const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(body.memories) || body.memories.length < 1) {
  console.error('BLOCK: search returned no memories');
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}
NODE

node - "$TMP_DIR/memory.json" > "$TMP_DIR/gate.json" <<'NODE'
const fs = require('fs');
const memory = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(JSON.stringify({
  queryText: 'DSG One memory smoke gate',
  scope: { purpose: 'planning', requireVerifiedEvidence: false },
  memories: [memory]
}));
NODE

request_json POST "$APP_URL/api/dsg/memory/gate" "$TMP_DIR/gate.json" "$TMP_DIR/gate.response.json" "$TMP_DIR/gate.status"
assert_ok_response "memory gate" "$TMP_DIR/gate.response.json" "$TMP_DIR/gate.status"

node - "$TMP_DIR/gate.response.json" <<'NODE'
const fs = require('fs');
const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!body.gate || !['PASS', 'REVIEW', 'BLOCK', 'UNSUPPORTED'].includes(body.gate.status)) {
  console.error('BLOCK: gate response missing valid status');
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}
NODE

node - "$TMP_DIR/memory.json" > "$TMP_DIR/context-pack.json" <<'NODE'
const fs = require('fs');
const memory = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(JSON.stringify({
  scope: { purpose: 'planning', requireVerifiedEvidence: false },
  memories: [memory],
  evidenceIds: [],
  auditIds: []
}));
NODE

request_json POST "$APP_URL/api/dsg/memory/context-pack" "$TMP_DIR/context-pack.json" "$TMP_DIR/context-pack.response.json" "$TMP_DIR/context-pack.status"
assert_ok_response "memory context pack" "$TMP_DIR/context-pack.response.json" "$TMP_DIR/context-pack.status"

node - "$TMP_DIR/context-pack.response.json" <<'NODE'
const fs = require('fs');
const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!body.contextPack || !body.contextPack.contextHash) {
  console.error('BLOCK: context-pack response missing contextHash');
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}
NODE

echo "PASS: DSG One governed memory API smoke completed"
echo "NOTE: dev-gated route proof only. This is not production auth/RBAC or production claim."
