import type { AppBuilderGoalInput, AppBuilderTargetStack, LockedAppBuilderGoal } from './model';
import { hashAppBuilderObject } from './hash';

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function cleanList(values?: string[]): string[] {
  return Array.from(new Set((values ?? []).map(cleanText).filter(Boolean)));
}

function normalizeStack(stack?: AppBuilderTargetStack): AppBuilderTargetStack {
  return {
    frontend: stack?.frontend ?? 'nextjs',
    backend: stack?.backend ?? 'next-api',
    database: stack?.database ?? 'none',
    auth: stack?.auth ?? 'none',
    deploy: stack?.deploy ?? 'none',
  };
}

export function lockAppBuilderGoal(input: AppBuilderGoalInput): LockedAppBuilderGoal {
  const originalGoal = input.goal ?? '';
  const normalizedGoal = cleanText(originalGoal);
  if (!normalizedGoal) throw new Error('APP_BUILDER_GOAL_REQUIRED');

  const successCriteria = cleanList(input.successCriteria);
  const constraints = cleanList(input.constraints);
  const targetStack = normalizeStack(input.targetStack);
  const lockedAt = new Date().toISOString();
  const goalHash = hashAppBuilderObject({ normalizedGoal, successCriteria, targetStack, constraints });

  return { originalGoal, normalizedGoal, successCriteria, targetStack, constraints, lockedAt, goalHash };
}
