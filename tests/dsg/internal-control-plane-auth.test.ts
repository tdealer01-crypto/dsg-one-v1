import { describe, expect, it } from 'vitest';

import { isDsgInternalControlPlaneAuthorized } from '../../lib/dsg/server/internal-control-plane-auth';

describe('DSG internal control-plane auth', () => {
  const secret = 'x'.repeat(64);

  it('accepts only the exact configured internal secret', () => {
    expect(isDsgInternalControlPlaneAuthorized(secret, {
      DSG_SPACETIME_INTERNAL_API_KEY: secret,
    })).toBe(true);
    expect(isDsgInternalControlPlaneAuthorized('y'.repeat(64), {
      DSG_SPACETIME_INTERNAL_API_KEY: secret,
    })).toBe(false);
  });

  it('fails closed when the internal secret is absent or too short', () => {
    expect(isDsgInternalControlPlaneAuthorized(secret, {})).toBe(false);
    expect(isDsgInternalControlPlaneAuthorized('short', {
      DSG_SPACETIME_INTERNAL_API_KEY: 'short',
    })).toBe(false);
  });
});
