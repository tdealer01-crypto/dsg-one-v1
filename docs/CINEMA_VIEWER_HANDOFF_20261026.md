# Cinema same-session login handoff

## Observed production journey

On26October2026 at02:22Asia/Bangkok, the genuine owner-approved exact plan `plan_ui_clickthrough_20261026_05` opened https://dsg.pics/ and clicked its actual primary Workroom link. Both provider steps completed, using one signed permit for the two reviewed steps. Independent verifier read412 observed `https://dsg.pics/login?next=%2Fdsg%2Fworkroom`. This proves the entry/login redirect and preserved destination; it does not prove authenticated Workroom or a completed Agent/Cinema/Native task.

- Execution411 evidence: `77fe572d4f63be2754c77eb27f4fa56235af7ff53fafce2c3938708bb9dc6d62`.
- Independent read412 evidence: `6f2eb7b6b6a7769c4d17b5d7d4359ca64f2901374adbdb683405d633cde60e8b`.
- Subsequent status413 confirmed the existing connected self-hosted provider. Final chain integrity: valid,414records. Integrity is not whole-task success.

## User benefit and change

Previously the human Viewer button required a separate account-check click, then accepted any nonempty viewer session identifier. The source did not compare it with the governed Agent browser session. No actual cross-account mismatch is asserted from that code omission.

The primary Viewer click now reads fresh governed status through the existing exact-plan/evidence-checked Workroom path, verifies the existing linked Free account, then opens only an exact AWS viewer whose provider and browser session ID match. One click replaces the mandatory separate account check. Missing readiness, account proof or session agreement shows the specific next action. Popup blocking releases controls and explains how to retry. The Workroom input lock prevents colliding commands during these checks.

Existing first-time Free-account proof and the optional account-check diagnostic remain. No account is created/linked automatically, no credential is transferred to the agent, no new browser/provider is created, and signed execution approvals remain required. Private viewer URLs stay only in the user's popup, outside receipts and logs.

## Validation and remaining proof

A real rendered-component test failed on the old source because the Viewer button was disabled until another click. The repaired component passes one-click matching-session opening, different-session rejection and both blocked-popup cases using explicit local identity/provider fixtures. Focused tests also cover missing governed evidence/readiness, unlinked account, unexpected provider, invalid viewer URL, historical session-ID prefix and no automatic retry.

These checks are local source/component fixtures, not production login proof. Full exact-head repository CI, immutable web deployment, a real linked-account same-session Viewer observation, human sign-in and independently observed authenticated Workroom remain separate required checks. The private Runtime's undeployed Unicode repair and blocked image builder remain separate issues.
