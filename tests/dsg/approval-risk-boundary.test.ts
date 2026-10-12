import { describe, expect, it } from 'vitest';
import { knownRiskTier } from '../../app/dsg/approvals/approval-client';

describe('human approval risk boundary', () => {
  it('only accepts explicitly verified tiers', () => {
    expect(knownRiskTier('standard')).toBe(true);
    expect(knownRiskTier('high')).toBe(true);
    expect(knownRiskTier('low')).toBe(false);
    expect(knownRiskTier('critical')).toBe(false);
    expect(knownRiskTier(null)).toBe(false);
    expect(knownRiskTier(undefined)).toBe(false);
    expect(knownRiskTier({ risk_tier: 'standard' })).toBe(false);
  });
});
