import { describe, expect, it } from 'vitest';
import { shouldRequestKaggleWake } from '@/lib/dsg/user-bound/kaggle-on-demand';

describe('Kaggle owner wake condition', () => {
  it('requests wake only for an unavailable or unbound Brain', () => {
    expect(shouldRequestKaggleWake(new Error('EXECUTION_FAILED:DSG_BRAIN_BASE_URL_INVALID'))).toBe(true);
    expect(shouldRequestKaggleWake(new Error('DSG_BRAIN_UPSTREAM_UNAVAILABLE'))).toBe(true);
  });

  it('never launches GPU for policy, approval, auth, inference, or model mismatch errors', () => {
    for (const reason of [
      'APPROVAL_REQUIRED', 'AUTH0_REAUTH_REQUIRED', 'ROUTE_NOT_AVAILABLE_OR_AMBIGUOUS',
      'DSG_BRAIN_HTTP_507', 'DSG_BRAIN_CONTEXT_EXCEEDED',
      'DSG_BRAIN_PROVIDER_MISMATCH', 'DSG_BRAIN_MODEL_MISMATCH',
      'EXECUTION_FAILED:DSG_BRAIN_ACTION_OUTSIDE_ALLOWED_SET',
    ]) {
      expect(shouldRequestKaggleWake(new Error(reason))).toBe(false);
    }
    expect(shouldRequestKaggleWake('DSG_BRAIN_BASE_URL_INVALID')).toBe(false);
  });
  it('does not wake Kaggle when an authorization error embeds a Brain error string', () => {
    expect(shouldRequestKaggleWake(new Error('AUTH_DENIED:DSG_BRAIN_BASE_URL_INVALID'))).toBe(false);
    expect(shouldRequestKaggleWake(new Error('PROVIDER_FAILURE:DSG_BRAIN_UPSTREAM_UNAVAILABLE'))).toBe(false);
  });

});
