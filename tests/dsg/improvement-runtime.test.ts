import { describe, expect, it } from 'vitest';
import {
  AGENTIC_IMPROVEMENT_SCHEMA_VERSION,
  buildImprovementRuntimeHandoff,
  gateImprovementExecution,
  type ImprovementExecutionRequest,
} from '../../lib/dsg/app-builder/improvement-runtime';

function request(): ImprovementExecutionRequest {
  return {
    schemaVersion: AGENTIC_IMPROVEMENT_SCHEMA_VERSION,
    candidateId: 'candidate-1',
    plan: {
      goalId: 'goal-1',
      approvedPlanHash: 'plan-hash',
      targetRepository: 'tdealer01-crypto/dsg-one-v1',
      baselineCommit: 'a'.repeat(40),
      allowedPaths: ['lib/dsg/app-builder/**', 'tests/dsg/**'],
      allowedOperations: ['READ', 'WRITE', 'TEST', 'BUILD', 'OPEN_PR'],
    },
    requestedPaths: ['lib/dsg/app-builder/improvement-runtime.ts'],
    requestedOperations: ['WRITE', 'TEST'],
  };
}

describe('governed improvement runtime', () => {
  it('allows actions inside an approved plan', () => {
    expect(gateImprovementExecution(request()).status).toBe('READY');
    expect(buildImprovementRuntimeHandoff(request()).promotionAuthority).toBe('DSG_CONTROL_PLANE');
  });

  it('blocks paths outside the approved plan', () => {
    const result = gateImprovementExecution({ ...request(), requestedPaths: ['app/api/billing/route.ts'] });
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toContain('PATH_OUTSIDE_APPROVED_SCOPE:app/api/billing/route.ts');
  });

  it('blocks prefix-collision paths that are not children of an approved directory', () => {
    const path = 'lib/dsg/app-builder-evil/route.ts';
    const result = gateImprovementExecution({ ...request(), requestedPaths: [path] });
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toContain(`PATH_OUTSIDE_APPROVED_SCOPE:${path}`);
  });

  it('blocks traversal paths even when their raw prefix looks approved', () => {
    const path = 'lib/dsg/app-builder/../billing/route.ts';
    const result = gateImprovementExecution({ ...request(), requestedPaths: [path] });
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toContain(`PATH_OUTSIDE_APPROVED_SCOPE:${path}`);
  });

  it('blocks alternate path separators', () => {
    const path = 'lib\\dsg\\app-builder\\improvement-runtime.ts';
    const result = gateImprovementExecution({ ...request(), requestedPaths: [path] });
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toContain(`PATH_OUTSIDE_APPROVED_SCOPE:${path}`);
  });

  it('blocks invalid approved path scopes', () => {
    const value = request();
    value.plan.allowedPaths = ['lib/dsg/app-builder/../billing/**'];
    const result = gateImprovementExecution(value);
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toContain('ALLOWED_PATH_SCOPE_INVALID:lib/dsg/app-builder/../billing/**');
  });

  it('blocks operations outside the approved plan', () => {
    const value = request();
    value.plan.allowedOperations = ['READ', 'TEST'];
    value.requestedOperations = ['WRITE'];
    const result = gateImprovementExecution(value);
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons).toContain('OPERATION_OUTSIDE_APPROVED_SCOPE:WRITE');
  });
});
