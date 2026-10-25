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

## Follow-up: unavailable tool session left the Viewer button disabled

The owner reported the entry could not be clicked. Fresh production read415 still saw the Cinema login page, so an authenticated live Viewer click has not been observed. Replaying the actual deployed component with an absent tool session reproduced the disabled primary button. The previous one-click checks used a ready session and missed this user state; their success did not establish the complete entry flow.

The Viewer entry now offers the existing Auth0 sign-in action when the tool session is absent. It uses the same callback and preserves the Workroom return path. Initialization, an active command or pending approval still disable conflicting inputs. A completed sign-in must be verified through the existing identity/session path; no ready flag, membership or provider permission is forced. Once ready, the same account/provider/session comparison remains required before opening the private viewer. No second authentication system or storage of credentials is introduced.

Tests cover the missing-session button, existing ready-session action, busy/initializing states and real rendered clicks with local fixtures. Those checks are still not a substitute for observing an authenticated production click. The existing Cinema context and its login page are preserved; no consumed entry permit is replayed.

Direct frontend browser verification then reached the existing signed-in DSG website Workroom. It showed “เข้าสู่ระบบเครื่องมือครั้งเดียวเพื่อใช้ Agent v0 และรีโมต” while the Viewer button was visible and disabled. A real click attempt failed with one matched visible button and `disabled=true`; its adjacent message incorrectly said to click it. The separate existing “เข้าสู่ระบบเครื่องมือ” button did work and reached the actual Auth0 sign-in page. No credentials or MFA values were entered. This frontend test is separate from the preserved Cinema provider context and does not transfer its cookies.

Local post-repair validation:39 focused tests, six rendered Viewer checks and22 existing UI checks passed, plus strict component TypeScript. The patch still requires exact-head CI, immutable web deployment, another actual primary-button click and real-account sign-in; do not report whole-task completion from these counts.
