# DSG Gateway Proof Bridge (Lane 16K-A)

This module bridges runtime action context into deterministic gateway proof output.

## Files

- `lib/dsg/runtime/gateway-proof-bridge.ts`

## Contract

Input context must include org, actor, and tool identity plus approval/risk fields.
Output always includes:

- `decision`
- `violated[]`
- `smt2Hash`
- `resultHash`

## Deterministic guarantees

- Violations are sorted by `code`.
- `smt2Hash` is computed from immutable policy constraints.
- `resultHash` is computed from stable-json payload including merge order coordinates:
  - `stage=bridge`
  - `topoIndex=1`
  - `taskId=16K-A`

## Blocking rules

Decision is `BLOCK` when any required context is missing:

- org
- actor
- tool
- required approval
- HIGH/CRITICAL risk without explicit approval

This lane only evaluates and hashes the gate output; it does not claim production proof.
