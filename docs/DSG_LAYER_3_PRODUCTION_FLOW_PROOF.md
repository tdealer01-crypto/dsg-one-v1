# DSG Layer 3: Production Flow Proof

## Purpose
Layer 3 adds a read-only production flow proof check for `dsg-one-v1`.

## Command

```bash
DSG_ONE_V1_PRODUCTION_URL=https://<production-url> npm run dsg:production-flow-check
```

## What it proves
The script performs a real HTTPS GET request to the supplied production URL and records deterministic hashes for the response body and proof payload.

## Output

```txt
DSG production flow check passed
url=<url>
status=200
bodyHash=sha256:<hash>
proofHash=sha256:<hash>
startedAt=<iso-time>
completedAt=<iso-time>
```

## Truth boundary
This layer is read-only. It does not insert runtime proof rows, seed data, mutate Supabase, or claim production readiness by itself.

A full production claim still requires:

```txt
1. production deployment READY
2. CI verification success
3. production flow proof output
4. runtime proof recording
5. completion gate with proof ids
```
