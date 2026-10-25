# dsg.pics Workroom: shared linear execution flow

This is a source candidate related to Runtime PR #840. It is not deployed and
does not enable bounded-plan consent, bypass MFA, start workers or replace the
existing signed per-request approval flow.

## User path

Open `https://dsg.pics/dsg/workroom`, select Agent / Browser / Native and use
the existing task control. Every lane displays the same sequence:

`Goal → Plan → Approval when required → Execute → Verify → Evidence`

The browser path composes one Plan containing the optional verified connect,
the exact navigation, and a distinct read-only verifier Route. Each provider
call has its own Runtime evidence. The read result must report complete success,
the same Plan ID/hash, `agent_verifier`, no fallback and an actual successful
HTTPS page observation. Its visible title/path appears below the task controls;
private URL queries and fragments are not displayed there.

The result card describes one evidenced step. A Native shell acknowledgement,
running process, unknown exit state or successful navigation is not labelled as
the entire user goal being completed. Existing signed permits and account-bound
Cinema viewer handoff are retained.

## Verification boundary

- 18 focused Vitest tests across three real source test files passed.
- Strict TypeScript check of the changed Workroom component, helper, tests and
  imported dependencies passed using a temporary validation environment.
- Runtime PR #840 adds owner-scoped durable bounded request status; that source
  is separate from this website's currently deployed per-request approval API.
- Full repository lint/typecheck/build/smoke scripts, exact-head CI, UI regression,
  a deployed owner-session browser run, actual MFA, detached worker, two real
  account isolation and immutable release binding remain unverified.

Next: run the repository's required checks and independent review before merge;
verify the exact serving source/digest and real user workflow after deployment.
Do not substitute the focused tests for those production gates.
