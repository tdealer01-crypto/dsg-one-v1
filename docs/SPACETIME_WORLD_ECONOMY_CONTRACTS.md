# DSG Spacetime provider, economy, and canonical evidence contracts

Status: Cycle 1 code contract; no live merchant/payment claim.

This module establishes three fail-closed primitives:

1. delegated wallet evaluation using integer minor units;
2. provider selection that only exposes explicitly AVAILABLE capabilities;
3. canonical world commits that require ALLOW + provider result + evidence + state hashes.

No provider in this module is hard-coded as live. A provider becomes selectable only from runtime inventory that marks it AVAILABLE with a route and evidence type.

Settlement and real payment remain disabled until provider credentials, exact approval binding, receipt verification, and replay evidence are proven.
