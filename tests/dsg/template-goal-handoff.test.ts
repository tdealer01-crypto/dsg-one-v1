import { describe, expect, it } from 'vitest';
import { parseDsgOutcomeIntake } from '../../lib/dsg/app-builder/outcome-intake';
import { templateGoalDraft } from '../../lib/dsg/client/template-goal-handoff';

const entry = { slug: 'saas-starter', name: 'SaaS Starter', description: 'Billing and authentication', approved: true, intake: { riskLevel: 'low' } };

describe('template to editable builder intent', () => {
  it('carries only the exact selected catalog entry and no approval or accepted intake', () => {
    const result = templateGoalDraft({ ok: true, data: [{ ...entry, slug: 'other' }, entry] }, 'saas-starter');
    expect(result.goal).toContain('SaaS Starter');
    expect(result.criteria).toEqual([entry.description]);
    expect(result.descriptionTruncated).toBe(false);
    expect(Object.keys(result).sort()).toEqual(['criteria', 'descriptionTruncated', 'goal', 'name', 'slug']);
  });

  it('prefills a valid server intake even for allowed 1800-character catalog descriptions', () => {
    const description = 'การติดตามงาน '.repeat(150).slice(0, 1800);
    const result = templateGoalDraft({ ok: true, data: [{ ...entry, name: 'N'.repeat(160), description }] }, 'saas-starter');
    expect(result.descriptionTruncated).toBe(true);
    expect(result.goal.length).toBeLessThanOrEqual(800);
    expect(result.criteria[0].length).toBeLessThanOrEqual(600);
    expect(result.criteria[0]).toMatch(/…$/);
    const accepted = parseDsgOutcomeIntake({
      goal: result.goal,
      successOutcome: result.criteria[0],
      targetUsers: [],
      availableData: [],
      requiredIntegrations: [],
      riskLevel: 'low',
      productionIntent: false,
    });
    expect('error' in accepted).toBe(false);
  });

  it('preserves Thai and emoji as complete Unicode sequences when shortening', () => {
    const description = 'ก'.repeat(598) + '😀' + 'ข'.repeat(80);
    const result = templateGoalDraft({ ok: true, data: [{ ...entry, description }] }, 'saas-starter');
    expect(result.criteria[0].length).toBeLessThanOrEqual(600);
    expect(result.criteria[0]).not.toMatch(/[\uD800-\uDBFF]$/);
    expect(result.descriptionTruncated).toBe(true);
  });

  it('rejects unavailable, malformed, missing and ambiguous selections', () => {
    for (const data of [null, {}, { ok: false, data: [entry] }, { ok: true, data: [] }, { ok: true, data: [entry, entry] }, { ok: true, data: [{ ...entry, description: null }] }]) {
      expect(() => templateGoalDraft(data, 'saas-starter')).toThrow();
    }
    for (const slug of [null, ['saas-starter'], '../secrets', 'https://example.com', 'x'.repeat(97)]) {
      expect(() => templateGoalDraft({ ok: true, data: [entry] }, slug)).toThrow();
    }
  });
});
