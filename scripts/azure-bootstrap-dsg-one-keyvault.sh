#!/usr/bin/env bash
set -euo pipefail

# One-time DSG ONE Key Vault bootstrap.
# Run only with an Azure identity that is Owner or User Access Administrator at
# the vault/resource-group scope. This script never prints secret values.

SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-dcf13c0d-0d9f-4f81-aa89-c6b50aaef839}"
RESOURCE_GROUP="${DSG_ONE_RESOURCE_GROUP:-rg-t.dealer01-0468}"
VAULT_NAME="${DSG_ONE_KEY_VAULT_NAME:-dsg-shared-secrets}"
WEBAPP_NAME="${DSG_ONE_WEBAPP_NAME:-dsg-one-v1}"
OIDC_OBJECT_ID="${DSG_ONE_GITHUB_OIDC_OBJECT_ID:-4de7b2bd-2cf2-4f9f-a290-1c3b448f483e}"
SETTING_NAME="${DSG_ONE_VAULT_SETTING_NAME:-DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY}"
SECRET_NAME="${DSG_ONE_VAULT_SECRET_NAME:-dsg-one-v1-supabase-service-role-key}"
APP_URL="${DSG_ONE_APP_URL:-https://dsg-one-v1.azurewebsites.net}"

fail() {
  echo "BLOCKED: $*" >&2
  exit 1
}

command -v az >/dev/null 2>&1 || fail "Azure CLI is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"

az account set --subscription "$SUBSCRIPTION_ID"

VAULT_ID=$(az keyvault show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VAULT_NAME" \
  --query id --output tsv)
[[ -n "$VAULT_ID" ]] || fail "Key Vault $VAULT_NAME was not found"

WEBAPP_PRINCIPAL=$(az webapp identity show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --query principalId --output tsv)
[[ -n "$WEBAPP_PRINCIPAL" ]] || fail "Web App managed identity is not enabled"

ensure_role() {
  local principal="$1" principal_type="$2" role="$3"
  local count
  count=$(az role assignment list \
    --assignee-object-id "$principal" \
    --scope "$VAULT_ID" \
    --query "[?roleDefinitionName=='$role'] | length(@)" \
    --output tsv 2>/dev/null || echo 0)
  if [[ "$count" == "0" ]]; then
    az role assignment create \
      --assignee-object-id "$principal" \
      --assignee-principal-type "$principal_type" \
      --role "$role" \
      --scope "$VAULT_ID" \
      --output none || fail "current Azure identity cannot grant '$role'; use Owner/User Access Administrator"
  fi
}

echo '[1/5] Grant least-privilege Key Vault roles'
ensure_role "$OIDC_OBJECT_ID" ServicePrincipal 'Key Vault Secrets Officer'
ensure_role "$WEBAPP_PRINCIPAL" ServicePrincipal 'Key Vault Secrets User'

echo "[2/5] Migrate $SETTING_NAME into Key Vault without printing its value"
CURRENT_VALUE=$(az webapp config appsettings list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --query "[?name=='$SETTING_NAME'].value | [0]" \
  --output tsv)

if [[ "$CURRENT_VALUE" == @Microsoft.KeyVault\(* ]]; then
  echo '      app setting is already a Key Vault reference'
elif [[ -n "$CURRENT_VALUE" ]]; then
  az keyvault secret set \
    --vault-name "$VAULT_NAME" \
    --name "$SECRET_NAME" \
    --value "$CURRENT_VALUE" \
    --output none
  unset CURRENT_VALUE
  az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$WEBAPP_NAME" \
    --settings "$SETTING_NAME=@Microsoft.KeyVault(VaultName=$VAULT_NAME;SecretName=$SECRET_NAME)" \
    --output none
else
  if ! az keyvault secret show --vault-name "$VAULT_NAME" --name "$SECRET_NAME" >/dev/null 2>&1; then
    fail "$SETTING_NAME is absent from App Service and $SECRET_NAME is absent from Key Vault"
  fi
  az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$WEBAPP_NAME" \
    --settings "$SETTING_NAME=@Microsoft.KeyVault(VaultName=$VAULT_NAME;SecretName=$SECRET_NAME)" \
    --output none
fi

echo '[3/5] Restart DSG ONE after binding'
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$WEBAPP_NAME"

echo '[4/5] Verify RBAC and reference state'
OIDC_ROLE=$(az role assignment list \
  --assignee-object-id "$OIDC_OBJECT_ID" \
  --scope "$VAULT_ID" \
  --query "[?roleDefinitionName=='Key Vault Secrets Officer'] | length(@)" \
  --output tsv)
APP_ROLE=$(az role assignment list \
  --assignee-object-id "$WEBAPP_PRINCIPAL" \
  --scope "$VAULT_ID" \
  --query "[?roleDefinitionName=='Key Vault Secrets User'] | length(@)" \
  --output tsv)
REFERENCE=$(az webapp config appsettings list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --query "[?name=='$SETTING_NAME'].value | [0]" \
  --output tsv)
[[ "$OIDC_ROLE" != "0" ]] || fail "GitHub OIDC Key Vault Secrets Officer role is missing"
[[ "$APP_ROLE" != "0" ]] || fail "Web App Key Vault Secrets User role is missing"
[[ "$REFERENCE" == @Microsoft.KeyVault\(* ]] || fail "$SETTING_NAME is not bound by Key Vault reference"

echo '[5/5] Probe production runtime'
for attempt in $(seq 1 30); do
  code=$(curl --silent --show-error \
    --output /tmp/dsg-one-agent-status.json \
    --write-out '%{http_code}' \
    "$APP_URL/api/agent/status" || true)
  if [[ "$code" == '200' ]]; then
    break
  fi
  [[ "$attempt" != '30' ]] || fail "production /api/agent/status did not return HTTP 200"
  sleep 10
done

python - <<'PY'
import json
from pathlib import Path
body = json.loads(Path('/tmp/dsg-one-agent-status.json').read_text(encoding='utf-8'))
if not isinstance(body, dict):
    raise SystemExit('BLOCKED: production status was not an object')
print('PASS: DSG ONE Key Vault RBAC, reference binding, and production status probe verified')
PY
