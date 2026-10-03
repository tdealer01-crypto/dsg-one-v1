import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const route = readFileSync(
  join(ROOT, 'app/api/dsg/xr/internal-intent/route.ts'),
  'utf8',
);
const receipt = readFileSync(
  join(ROOT, 'lib/dsg/core-spin/xr-receipt.ts'),
  'utf8',
);

describe('XR internal federation source contract', () => {
  it('requires exact internal control-plane authentication', () => {
    expect(route).toContain('isDsgInternalControlPlaneAuthorized');
    expect(route).toContain("request.headers.get('x-dsg-internal-key')");
    expect(route).toContain('DSG_INTERNAL_AUTH_REQUIRED');
  });

  it('accepts only verified OAuth principals from the edge', () => {
    expect(route).toContain("principal.startsWith('oauth:')");
    expect(route).toContain('XR_FEDERATED_PRINCIPAL_INVALID');
  });

  it('executes only through Core Spin and exposes no provider shortcut', () => {
    expect(route).toContain('normalizeXrReadIntentToCoreSpin');
    expect(route).toContain('executeGovernedProposal');
    expect(route).not.toContain('callSpacetimeTool');
    expect(route).not.toContain('fetch(');
    expect(receipt).toContain("orchestration_authority: 'dsg-core-spin'");
    expect(receipt).toContain('direct_provider_access: false');
  });
});
