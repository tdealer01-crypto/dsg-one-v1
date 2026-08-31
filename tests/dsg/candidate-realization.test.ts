import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  appBuilderGoalFromCandidateRealization,
  constrainPlanToRealizationAuthorization,
  verifyStoredRealizationAuthorization,
  type CandidateRealizationSpecV1,
  type RealizationAuthorizationReceipt,
} from '../../lib/dsg/app-builder/candidate-realization';
import { assertCandidateRealizationExecutionAuthorized } from '../../lib/dsg/app-builder/realization-execution-gate';
import type { AppBuilderJob, AppBuilderProposedPlan } from '../../lib/dsg/app-builder/model';

const SECRET = 'unit-test-realization-secret';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function spec(): CandidateRealizationSpecV1 {
  const payload = {
    schemaVersion: 'dsg-candidate-realization-v1' as const,
    candidateId: 'candidate-code-1',
    candidateKind: 'CODE_CANDIDATE' as const,
    goalId: 'goal-code-1',
    targetRepository: 'tdealer01-crypto/dsg-one-v1',
    baselineCommit: 'a'.repeat(40),
    candidateCommit: 'b'.repeat(40),
    approvedPlanHash: 'c'.repeat(64),
    simulationHash: 'd'.repeat(64),
    allowedPaths: ['lib/dsg/app-builder/**', 'tests/dsg/**'],
    objectiveContract: {
      metricName: 'fitness_composite',
      direction: 'HIGHER_IS_BETTER' as const,
      baselineValue: 0.7,
      candidateValue: 0.8,
    },
    candidateAuthority: 'SIMULATION_ONLY' as const,
    promotionAuthority: 'DSG_CONTROL_PLANE' as const,
    selfPromotionAllowed: false as const,
    directProductionWriteAllowed: false as const,
    realization: {
      action: 'GENERATE_CODE_PATCH' as const,
      capabilityId: 'capability-1',
      capabilityDescription: 'Improve governed Builder realization flow.',
      acceptanceCriteria: ['authorization binding test passes'],
    },
    valueContract: {
      metricName: 'first_value_success_rate',
      direction: 'HIGHER_IS_BETTER' as const,
      baselineValue: 0.7,
      targetValue: 0.8,
      measurementSource: 'canary workflow',
      guardrails: ['no direct production writes'],
    },
    requiredEvidence: ['CODE_PATCH', 'TEST_OUTPUT', 'BUILD_OUTPUT'],
  };
  return { ...payload, specSha256: sha256(JSON.stringify(payload)) };
}

function receipt(input = spec()): RealizationAuthorizationReceipt {
  const payload = {
    schemaVersion: 'dsg-realization-authorization-v1' as const,
    status: 'ALLOW' as const,
    candidateId: input.candidateId,
    goalId: input.goalId,
    targetRepository: input.targetRepository,
    baselineCommit: input.baselineCommit,
    originCandidateCommit: input.candidateCommit,
    approvedPlanHash: input.approvedPlanHash,
    specSha256: input.specSha256,
    allowedPaths: [...input.allowedPaths],
    allowedOperations: ['READ', 'WRITE', 'TEST', 'BUILD', 'OPEN_PR'] as RealizationAuthorizationReceipt['allowedOperations'],
    authority: 'DSG_CONTROL_PLANE' as const,
    directProductionWriteAllowed: false as const,
    issuedAt: '2026-08-31T00:00:00.000Z',
  };
  return { ...payload, receiptSha256: sha256(JSON.stringify(payload)) };
}

function authorization(input = spec()) {
  const value = receipt(input);
  return {
    receipt: value,
    receiptSignature: createHmac('sha256', SECRET).update(JSON.stringify(value)).digest('hex'),
  };
}

function plan(): AppBuilderProposedPlan {
  return {
    title: 'Candidate realization',
    summary: 'Implement approved capability',
    steps: [
      {
        id: 'inspect',
        title: 'Inspect',
        description: 'Inspect code',
        phase: 'INSPECT',
        riskLevel: 'LOW',
        requiresApproval: false,
        allowedPaths: ['lib/**', 'app/**'],
        allowedCommands: [],
        requiredSecrets: [],
        expectedEvidence: ['inspection'],
      },
      {
        id: 'test',
        title: 'Test',
        description: 'Run tests',
        phase: 'TEST',
        riskLevel: 'MEDIUM',
        requiresApproval: true,
        allowedPaths: ['tests/**'],
        allowedCommands: ['npm test'],
        requiredSecrets: [],
        expectedEvidence: ['test-output'],
      },
    ],
    allowedTools: ['file.read', 'file.write', 'github.branch.create'],
    allowedPaths: ['lib/**', 'app/**', 'tests/**'],
    allowedCommands: ['npm test'],
    requiredSecrets: [],
    estimatedRiskLevel: 'MEDIUM',
  };
}

describe('candidate realization adapter', () => {
  it('maps simulation intent into a locked-goal input without granting runtime approval', () => {
    const goal = appBuilderGoalFromCandidateRealization(spec());
    expect(goal.goal).toContain('Builder realization');
    expect(goal.successCriteria).toContain('authorization binding test passes');
    expect(goal.constraints?.some((item) => item.includes('No direct production writes'))).toBe(true);
  });

  it('verifies the Control Plane receipt signature and exact candidate binding', () => {
    const input = spec();
    const verified = verifyStoredRealizationAuthorization(input, authorization(input), {
      DSG_REALIZATION_AUTHORIZATION_SECRET: SECRET,
    });
    expect(verified.authority).toBe('DSG_CONTROL_PLANE');
    expect(verified.originCandidateCommit).toBe(input.candidateCommit);
  });

  it('rejects a tampered receipt', () => {
    const input = spec();
    const auth = authorization(input);
    auth.receipt.allowedPaths = ['app/**'];
    expect(() => verifyStoredRealizationAuthorization(input, auth, {
      DSG_REALIZATION_AUTHORIZATION_SECRET: SECRET,
    })).toThrow();
  });

  it('intersects the App Builder plan with the independently authorized scope', () => {
    const constrained = constrainPlanToRealizationAuthorization(plan(), receipt());
    expect(constrained.allowedPaths).toEqual(['lib/dsg/app-builder/**', 'tests/dsg/**']);
    expect(constrained.allowedPaths).not.toContain('app/**');
  });

  it('blocks execution if an approved App Builder plan widens the receipt scope', () => {
    const input = spec();
    const approvedPlan = plan();
    const job = {
      id: 'job-1',
      workspaceId: 'workspace-1',
      createdBy: 'actor-1',
      status: 'READY_FOR_RUNTIME',
      claimStatus: 'APPROVED_ONLY',
      approvedPlan: {
        proposedPlan: approvedPlan,
        gateResult: { status: 'REVIEW', riskLevel: 'MEDIUM', approvalRequired: true, issues: [] },
        planHash: 'plan-hash',
        approvalHash: 'approval-hash',
        approvedBy: 'actor-1',
        approvedAt: '2026-08-31T00:00:00.000Z',
        decision: 'APPROVE',
      },
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z',
      metadata: {
        intakeSource: 'GOVERNED_SIMULATION_CANDIDATE',
        candidateRealizationSpec: input,
        realizationAuthorization: authorization(input),
      },
    } as AppBuilderJob;

    expect(() => assertCandidateRealizationExecutionAuthorized(job, {
      DSG_REALIZATION_AUTHORIZATION_SECRET: SECRET,
    })).toThrow('APP_BUILDER_REALIZATION_APPROVED_PLAN_SCOPE_WIDENED');
  });
});
