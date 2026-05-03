# DSG Layer 1: Verification / CI

## Purpose
Layer 1 exists to prove repository-level verification before any broader production claim.

## Required checks

```bash
npm run dsg:claim-gate
npm run dsg:runtime-check
npm run dsg:typecheck
npm run lint
npm run dsg:verify
```

## Merge rule
This layer may be merged only as a single verification-layer change. Do not add unrelated runtime behavior to this layer.

## Truth boundary
- A Vercel production deployment can prove deployability for a commit.
- GitHub Actions or local command logs are still required to claim repository verification.
- Production readiness still requires deployment proof and production user-flow proof.

## Current deployment evidence
The latest recorded deployment proof is GitHub issue #11. It records Vercel production `READY` for commit `100d89b3b18a810735a284688f1469ae074eccb5`.

## No-mock rule
This layer must not insert seed data, fake jobs, fake proof rows, or mock production claims.
