# DSG Layer 2: Read API

## Purpose
Layer 2 adds read-only runtime visibility from the Supabase source-of-truth.

## Routes

```txt
GET /api/dsg/jobs
GET /api/dsg/jobs/[jobId]
```

## Data source
The routes read from Supabase server-side after server-verified DSG actor resolution.

## Included timeline tables

```txt
dsg_runtime_events
dsg_evidence_items
dsg_evidence_manifests
dsg_audit_exports
dsg_replay_proofs
dsg_deployment_proofs
dsg_production_flow_proofs
dsg_completion_reports
```

## Truth boundary
This layer is read-only. It must not seed jobs, insert mock proof rows, or claim production state.
