# Production Dependency Security Audit Report

**Generated:** 2026-08-22  
**Status:** 9 high-severity vulnerabilities requiring Next.js 16+ migration

## Affected Packages

The following packages have known high-severity vulnerabilities in the current Next.js 15.4.9 environment:

| Package | Vulnerability | Severity | Remediation |
|---------|---------------|----------|------------|
| next | Multiple (DoS, SSRF, XSS, cache poisoning) | high | Upgrade to 16.3.2+ |
| postcss | XSS, information disclosure, path traversal | high | Upgrade via Next.js 16.3.2 |
| sharp | libvips CVEs (CVE-2026-33327, -33328, -35590, -35591) | high | Upgrade via Next.js 16.3.2 |
| nanoid | Infinite loop DoS | high | Upgrade to 3.3.18+ |
| protobufjs | Code injection, DoS | high | Upgrade to 7.6.5+ |
| Hono | CSS injection, JWT validation | high | Transitive via google/genai |
| ip-address | XSS, SSRF/trust boundary bypass | high | Transitive via express-rate-limit |
| ws | Memory disclosure, DoS | high | Transitive via google/genai |

## Root Cause

Next.js 15.4.9 bundles vulnerable versions of:
- postcss <= 8.5.22
- sharp < 0.35.0

Fixes are available in Next.js 16.3.2+, but this is a **breaking change** requiring migration.

## Breaking Changes in Next.js 16

1. **Turbopack enabled by default** — webpack config needs turbopack migration
2. **Middleware convention deprecated** — migrate from middleware.ts to proxy
3. **ESLint configuration removed from next.config.ts**
4. Multiple API changes and deprecations

## Remediation Path (Phase: Sprint 3)

### Option 1: Direct Upgrade (Recommended)
```bash
npm install next@16.3.2 --save
# Then address:
# - Convert webpack config to turbopack
# - Migrate middleware.ts to proxy  
# - Remove eslint from next.config.ts
# - Test all functionality
```

### Option 2: Feature Flag (Temporary)
Keep audit-level=moderate temporarily while planning Next.js 16 migration.  
Requires explicit override and documentation.

### Option 3: Manual Package Updates (Limited)
Some vulnerabilities can be patched individually:
```bash
npm install nanoid@3.3.18 --save  # Direct fix
npm install protobufjs@7.6.5 --save  # Direct fix
```
However, sharp and postcss remain unfixed in Next.js 15.

## Deployment Gate

**PR #120 is blocked until one of these is resolved:**

1. All 9 high-severity vulnerabilities remediated, OR
2. Explicit security waiver from maintainer (with risk acceptance), OR
3. CVSS risk assessment and exemption list approved

## Timeline

- **Current:** Vulnerabilities documented and audit check activated
- **Sprint 3:** Plan Next.js 16 migration with 2-week sprint allocation
- **Sprint 3+1:** Execute migration, test, deploy

## References

- Next.js 16 Migration Guide: https://nextjs.org/docs/app/upgrading
- npm audit report: Run `npm audit --omit=dev --json`
- CVSS Scores: Each vulnerability linked in audit output
