# DSG ONE — UI/UX upgrade and acceptance contract

Status: UI source candidate; real task completion NOT VERIFIED. Related Runtime PR840 and merged website PR257 remain separate proof scopes. Preserving old controls or URLs does not establish that those old paths work.

## User goal
Start a real task, follow one understandable workflow, approve only when required, and find the result and its evidence without reading logs. Keep every existing capability, destination, identity boundary, plan, permit and provider integration.

## Grounding
Fresh public screenshots captured 25 October 2026: desktop dsg.pics and the mobile Workroom sign-in entry. The protected Workroom redirected to login; no authenticated page audit is claimed. Implementation uses the actual current web source b0730238d8439734d9e8bd32acfaf1c771ca9d5e. No generated usage counts, fake jobs, fabricated provider status or example account is shipped.

## Changes and user benefit

| Area | Concrete change | User benefit / preservation |
| --- | --- | --- |
| Design system | Neutral dark surfaces, consistent spacing, restrained accent; remove wildcard !important colour/glow overrides | Read labels and real warning/success states clearly; retain existing component tokens and state colours |
| Homepage | Compact hero/cards; keep direct tool links and move dated deep technical snapshot later | Start sooner; every original tool and evidence destination remains directly linked |
| Login | Compact form, explicit labels, password-manager autocomplete, optional password visibility, readable feedback | Same two required fields and same existing authentication endpoint/return destination; no new gate |
| Keyboard | Skip links, visible focus, roving tab stops with arrows/Home/End, real associated tab panels | Use all tools without a pointer; changing tabs grants no authority and dispatches no provider request |
| Mobile menu | Native modal dialog plus explicit focus wrap, Escape and focus return | Reach the same existing destinations without losing focus behind the menu |
| Narrow screens | Layout at 320/390/768/1440 CSS pixels; bounded action column | Avoid horizontal scrolling and clipped actions; preserve all controls |
| Status and errors | Atomic status announcements and an alert for login errors | Understand what happened and continue without inspecting developer logs |
| Motion and system settings | Reduced-motion and forced-colour support; preserve Android coarse-pointer drawer | Respect device settings and the user's existing Android usage |

## Standards and familiar product patterns
The design target is WCAG 2.2 AA for the changed surfaces, with 44 CSS-pixel primary form controls as an additional design choice. WCAG 2.5.8 itself uses a 24 CSS-pixel minimum with exceptions; 44 is not misrepresented as its AA requirement. Test normal-text contrast, narrow-width reflow, visible/unobscured focus, names/roles, keyboard operation and status messages. Use task/workspace/ordered-state concepts familiar from established work-management tools; do not copy branding or claim equivalence to a market leader.

Sources:
- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://linear.app/docs/conceptual-model

## Acceptance evidence
1. Real entry → authentication → plan → required approval → actual execution → independent final result → durable evidence. Test Agent, Cinema and Native separately; only a verified business outcome can pass the whole journey.
2. Preserve protected identity and exact signed approval/provider contracts while repairing broken paths. Button/URL inventory is only a guard against losing capabilities.
3. Keyboard tests cover skip navigation, mobile menu, focus containment/return and tab relationships.
4. Narrow-screen checks and local axe WCAG-tagged scans on the rendered changed surfaces.
5. Meaningful contract tests and strict TypeScript; exact-head repository CI/build before merge.
6. Verify post-merge checks, immutable image/source identity and fresh public screenshots after deployment. This verifies the UI release, not unrelated task outcomes.

## Actual task click-through finding

The genuinely approved production plan `plan_ui_clickthrough_20261025_01` attempted the homepage and its Thai start link through the existing AWS Cinema browser. It failed with `EXECUTION_FAILED:CINEMA_TOOL_SPACETIME_ARGUMENTS_SCOPE_MISMATCH` before navigation. Independent read record408 still showed the preceding AWS Startups page. Therefore this journey FAILED; no protected Workroom or completed task was reached.

The mismatch is reproduced in actual source: Runtime hashes normalized arguments as UTF8 JSON, while Cinema canonical JSON ASCII-escapes non-ASCII text. The narrow source repair is Private Runtime [PR842](https://github.com/tdealer01-crypto/DSG-Private-Production-Runtime/pull/842). Do not bypass the digest or reuse a consumed approval. Live deployment and a fresh Thai-click test remain separate gates.

| Task path | Evidence available | Completion acceptance |
| --- | --- | --- |
| Homepage → Workroom | Genuine signed click rejected; independent read408 reconciled unchanged page | FAILED at Cinema argument binding; retry only with a fresh valid signed request |
| Agent primary chat → task | Reviewed source records a durable queued job; no real worker result observed in this session | NOT VERIFIED; creation and `START_ALLOWED` are not execution |
| Cinema → website task | Fresh read/status work; mutating Thai click above failed | NOT VERIFIED until actual action and independent final postcondition |
| Native → device task | Fresh bound Linux-device status observed | NOT VERIFIED; online status is not a completed device action |

The 22 local UI checks below cover appearance, keyboard interaction, authentication-error display and capability preservation. They must not be reported as these four task journeys passing.

## Truth boundary
The browser harness renders the actual component source with local Next-link/router display adapters and only local unauthenticated/error responses. It contains no production accounts, tokens or provider execution. Its screenshots and axe results are local component evidence, not real Auth0 or high-risk production E2E. Automated axe scans and screenshots do not certify full WCAG conformance or replace manual screen-reader/real-device testing. No new production dependency, app, paid resource, signer, permission or approval gate is introduced.

Real post-review Owner MFA, a detached bounded worker, real provider postcondition/readback, two-account isolation and exact immutable deployment of PR840 still require their own evidence. The UX upgrade does not turn these missing proofs into PASS.

## Completed local checks

- 22 rendered-browser checks passed; zero unexpected browser exceptions.
- axe found zero WCAG-tagged violations in five checked states: mobile/desktop home, mobile login, open navigation drawer, and Native panel with no authenticated identity. This is limited automated evidence.
- 25 existing/new focused Vitest tests passed; strict component/dependency TypeScript passed.
- Original public/admin links and all three tool panels' original operations/inputs match the baseline.
- The first browser pass found real 768px overflow; a later pass found native-dialog focus reaching the document body. Both were fixed and the full local checks reran successfully.
- Found and removed the stale hardcoded Android/Termux device description. Device details now render only from a successful Native status receipt with matching outer/inner device IDs and a real registry binding, after caller receipt/evidence checks. Unknown status remains unknown; no platform or online flag is invented. This is display validation, not proof of multi-account device isolation.
- Evidence: `docs/evidence/ux-component-verification-20261025.json`. Full exact-head CI and deployed UI verification remain separate until recorded.

CI follow-up: an existing homepage test required the native `<details className="group relative">` opening tag. Retained that native element and moved optional Escape handling to its containing element. All four original homepage tests and the 22 rendered keyboard/UI checks pass; no test was weakened or deleted.
