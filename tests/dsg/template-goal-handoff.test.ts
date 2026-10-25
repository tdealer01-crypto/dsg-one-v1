import { describe, expect, it } from 'vitest';
import { templateGoalDraft } from '../../lib/dsg/client/template-goal-handoff';

const entry = { slug: 'saas-starter', name: 'SaaS Starter', description: 'Billing and authentication', approved: true, intake: { riskLevel: 'low' } };

describe('template to editable builder intent', () => {
  it('carries only the exact selected catalog entry and no approval or accepted intake', () => {
    const result = templateGoalDraft({ ok: true, data: [{ ...entry, slug: 'other' }, entry] }, 'saas-starter');
    expect(result.goal).toContain('SaaS Starter');
    expect(result.criteria).toEqual([entry.description]);
    expect(Object.keys(result).sort()).toEqual(['criteria', 'goal', 'name', 'slug']);
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
