import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/deploy-dsg-one-production.yml', 'utf8');

describe('DSG ONE governed Azure deployment workflow', () => {
  it('deploys the push SHA and uses a run-unique locked image tag', () => {
    expect(workflow).toContain(
      "SOURCE_SHA: ${{ github.event_name == 'workflow_dispatch' && inputs.source_sha || github.sha }}",
    );
    expect(workflow).toContain(
      'IMAGE_TAG="prod-${SHORT_SHA}-run-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"',
    );
    expect(workflow).toContain('--write-enabled false');
    expect(workflow).toContain('--build-arg "DSG_BUILD_SOURCE_SHA=$SOURCE_SHA"');
  });

  it('requires live source, digest, and database identity before readiness passes', () => {
    expect(workflow).toContain('$APP_URL/api/agent/status');
    expect(workflow).toContain('.deployment.buildSourceSha == $sha');
    expect(workflow).toContain('.deployment.imageDigest == $digest');
    expect(workflow).toContain('.checks.db == true');
    expect(workflow).toContain('.readiness.deploymentIdentityOk == true');
  });

  it('records the protected route truth without turning a negative control into E2E PASS', () => {
    expect(workflow).toContain('verify_page_http:$verify_http');
    expect(workflow).toContain('verify_redirect_location:$verify_location');
    expect(workflow).toContain('.runtimeGate.status == "BLOCKED"');
    expect(workflow).toContain('negative_control_is_not_positive_runtime_execution:true');
    expect(workflow).toContain('governed_candidate_chain_verified:false');
    expect(workflow).toContain(
      "governed candidate/Cinema/Control Plane/Monitoring chain: `NOT_EVALUATED`",
    );
    expect(workflow).not.toContain('probes:{verify_page_http:200');
  });

  it('requires real or idempotently completed ActiveCampaign delivery', () => {
    expect(workflow).toContain(
      '.delivery.delivered == true or .delivery.reason == "ALREADY_DELIVERED"',
    );
    expect(workflow).toContain(
      '.lifecycle.delivered == true or .lifecycle.reason == "ALREADY_DELIVERED"',
    );
    expect(workflow).toContain('lifecycle_satisfied:true');
  });
});
