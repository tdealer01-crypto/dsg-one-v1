# Katzilla Free Data Connector

Katzilla is an optional external data and agent-catalog connector for DSG ONE V1.

It is useful for pulling free/public data into DSG agent workflows without making Katzilla part of the required product-ready gate.

## Current status

```text
Connector: optional
Katzilla API key configured locally: verified by operator
Agents catalog: verified by operator
Product-ready gate requirement: false
Production verification by itself: false
Credential location: server-side only
```

## Verified local connector shape

```bash
KATZILLA_API_BASE=https://api.katzilla.dev
KATZILLA_API_KEY=<server-side secret only>
KATZILLA_AGENTS_PATH=/agents
```

Do not commit the real `KATZILLA_API_KEY`.

## Verified agent catalog examples

The `/agents` catalog can expose handles such as:

```text
agriculture
trade
telecom
meta
international
patents
```

These handles indicate available public-data domains, not DSG production proof.

## Example calls

List the available Katzilla agents:

```bash
curl -H "X-API-Key: $KATZILLA_API_KEY" \
  "$KATZILLA_API_BASE/agents"
```

Example source call from Katzilla onboarding:

```bash
curl -H "X-API-Key: $KATZILLA_API_KEY" \
  "$KATZILLA_API_BASE/v1/fda/recalls?_limit=3"
```

Example SEC call from Katzilla onboarding:

```bash
curl -H "X-API-Key: $KATZILLA_API_KEY" \
  "$KATZILLA_API_BASE/v1/sec/filings?ticker=AAPL&limit=5"
```

If a route returns `404`, treat the endpoint path as unavailable or changed and consult the live Katzilla docs/catalog before building DSG logic around it.

## DSG truth boundary

Katzilla data is external evidence input. It is not DSG production verification by itself.

Before using retrieved data in a user-visible decision, DSG should preserve:

```text
source endpoint
request timestamp
citation object
retrieval timestamp
response hash or data hash
operator-visible truth label
```

## Safety rules

```text
Keep KATZILLA_API_KEY server-side only.
Never expose it through NEXT_PUBLIC_*.
Never commit it to GitHub.
Do not make Katzilla required for product-ready gate.
Fail closed on 401, 403, malformed JSON, missing citation data, or route mismatch.
```

## Safe wording

```text
optional free public-data connector for DSG agents
```

Do not claim:

```text
production proof
verified compliance source
guaranteed complete dataset
```
