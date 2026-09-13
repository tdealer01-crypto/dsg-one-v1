# DSG Deployment Verification

This document records the current deployment verification boundary for `dsg-one-v1`.

## Production authority

- Provider: **Microsoft Azure**
- Runtime: Azure App Service
- App: `dsg-one-v1`
- Production status endpoint: `https://dsg-one-v1.azurewebsites.net/api/agent/status`
- Supabase project URL: `https://zeyguilldygozufpgxms.supabase.co`
- Runtime secrets: Azure Key Vault via App Service Managed Identity
- Vercel: **retired; not production authority**

## Latest verified production receipt

Verified on **2026-09-13 ICT** from GitHub Actions production run `34769532385`.

```text
source_sha=0a45fb71733e26d024627cd4a39d5eb23662c721
image_digest=sha256:24c0cc92687415760d38d636cb96f4347a39bf5eb96e41dd3717fb5a771c1631
agent_status_http=200
ok=true
db=true
automationDb=true
automationEngine=true
database_status=200
automation_database_status=200
engine=microsoft-agent-framework
engine_version=1.18.0
sourceBound=true
digestBound=true
workflow_conclusion=success
```

## Verification rule

A production claim is allowed only when the deployed runtime proves the exact source SHA and image digest, database readiness, Automation Spacetime database readiness, and automation engine readiness. Missing or mismatched evidence remains fail-closed.

Runtime PASS does **not** imply marketplace acceptance, third-party certification, independent audit, legal compliance, SOC 2, ISO certification, or cloud-provider endorsement. Those require separate evidence.
