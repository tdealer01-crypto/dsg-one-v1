import { describe, it, expect } from 'vitest';
import { decideDsgAuthorization } from '../../lib/dsg/security/authorization-contract';

describe('decideDsgAuthorization', () => {
  const base = {
    action: 'read',
    resource: 'document',
    subjectId: 'user-1',
    orgId: 'org-1',
    allowedActions: ['read', 'write'],
    sameOrg: true,
  };

  it('returns ALLOW when all conditions are met', () => {
    const result = decideDsgAuthorization(base);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('ALLOW');
    expect(result.auditRequired).toBe(true);
    expect(result.subjectId).toBe('user-1');
    expect(result.orgId).toBe('org-1');
  });

  it('returns MISSING_SUBJECT when subjectId is absent', () => {
    const result = decideDsgAuthorization({ ...base, subjectId: null });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('MISSING_SUBJECT');
    expect(result.subjectId).toBeNull();
    expect(result.auditRequired).toBe(true);
  });

  it('returns MISSING_SUBJECT when subjectId is undefined', () => {
    const { subjectId: _, ...rest } = base;
    const result = decideDsgAuthorization(rest);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('MISSING_SUBJECT');
  });

  it('returns MISSING_ORG when orgId is absent', () => {
    const result = decideDsgAuthorization({ ...base, orgId: null });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('MISSING_ORG');
    expect(result.orgId).toBeNull();
    expect(result.auditRequired).toBe(true);
  });

  it('returns ORG_DENIED when sameOrg is explicitly false', () => {
    const result = decideDsgAuthorization({ ...base, sameOrg: false });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ORG_DENIED');
    expect(result.auditRequired).toBe(true);
  });

  it('does NOT return ORG_DENIED when sameOrg is undefined (undefined != false)', () => {
    const { sameOrg: _, ...rest } = base;
    const result = decideDsgAuthorization(rest);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('ALLOW');
  });

  it('returns POLICY_MISSING when allowedActions is absent', () => {
    const { allowedActions: _, ...rest } = base;
    const result = decideDsgAuthorization(rest);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('POLICY_MISSING');
    expect(result.auditRequired).toBe(true);
  });

  it('returns ROLE_DENIED when action is not in allowedActions', () => {
    const result = decideDsgAuthorization({ ...base, action: 'delete', allowedActions: ['read', 'write'] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ROLE_DENIED');
    expect(result.action).toBe('delete');
    expect(result.auditRequired).toBe(true);
  });

  it('propagates action and resource in all responses', () => {
    const result = decideDsgAuthorization({ ...base, subjectId: null });
    expect(result.action).toBe('read');
    expect(result.resource).toBe('document');
  });

  it('checks allowedActions membership with exact match', () => {
    const result = decideDsgAuthorization({ ...base, action: 'READ', allowedActions: ['read'] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ROLE_DENIED');
  });
});
