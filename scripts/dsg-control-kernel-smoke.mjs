#!/usr/bin/env node

const claimOrder = ['PLANNED_ONLY', 'IMPLEMENTED_UNVERIFIED', 'DEPLOYABLE_VERIFIED', 'READY_VERIFIED'];

const required = {
  PLANNED_ONLY: ['goal_locked', 'plan_visible'],
  IMPLEMENTED_UNVERIFIED: ['goal_locked', 'plan_visible', 'approval_recorded', 'branch_or_pr_created'],
  DEPLOYABLE_VERIFIED: ['goal_locked', 'plan_visible', 'approval_recorded', 'branch_or_pr_created', 'typecheck_passed', 'build_passed', 'preview_loaded'],
  READY_VERIFIED: ['goal_locked', 'plan_visible', 'approval_recorded', 'branch_or_pr_created', 'typecheck_passed', 'build_passed', 'preview_loaded', 'rbac_checked', 'protected_value_scan_passed', 'flow_proof_passed'],
};

function allowedClaim(requested, signals) {
  const verified = new Set(Object.entries(signals).filter(([, value]) => value === true).map(([key]) => key));
  for (let i = claimOrder.indexOf(requested); i >= 0; i -= 1) {
    const claim = claimOrder[i];
    if (required[claim].every((key) => verified.has(key))) return claim;
  }
  return 'PLANNED_ONLY';
}

const cases = [
  { name: 'plan only passes', requested: 'PLANNED_ONLY', signals: { goal_locked: true, plan_visible: true }, expect: 'PLANNED_ONLY' },
  { name: 'build claim downgraded without build proof', requested: 'DEPLOYABLE_VERIFIED', signals: { goal_locked: true, plan_visible: true, approval_recorded: true, branch_or_pr_created: true }, expect: 'IMPLEMENTED_UNVERIFIED' },
  { name: 'ready claim downgraded without preview', requested: 'READY_VERIFIED', signals: { goal_locked: true, plan_visible: true, approval_recorded: true, branch_or_pr_created: true, typecheck_passed: true, build_passed: true }, expect: 'IMPLEMENTED_UNVERIFIED' },
];

for (const item of cases) {
  const actual = allowedClaim(item.requested, item.signals);
  if (actual !== item.expect) {
    console.error(`BLOCK: ${item.name}: expected ${item.expect}, got ${actual}`);
    process.exit(1);
  }
}

console.log('PASS: deterministic control kernel smoke checks passed');
