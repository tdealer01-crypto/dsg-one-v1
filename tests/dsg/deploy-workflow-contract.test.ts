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

  it('pins production to the verified Supabase project and rejects DNS drift before build', () => {
    expect(workflow).toContain('SUPABASE_PROJECT_REF: zeyguilldygozufpgxms');
    expect(workflow).toContain('SUPABASE_PROJECT_URL: https://zeyguilldygozufpgxms.supabase.co');
    expect(workflow).toContain('Validate canonical Supabase endpoint');
    expect(workflow).toContain("await dns.lookup(url.hostname)");
    expect(workflow).toContain('PUBLIC_URL="$SUPABASE_PROJECT_URL"');
    expect(workflow).toContain('"NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL=$SUPABASE_PROJECT_URL"');
    expect(workflow).toContain('"DSG_ONE_V1_SUPABASE_URL=$SUPABASE_PROJECT_URL"');
    expect(workflow).not.toContain("rows.find((x) => x.name === 'NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL')");
  });

  it('requires live source, digest, and database identity before readiness passes', () => {
    expect(workflow).toContain('$APP_URL/api/agent/status');
    expect(workflow).toContain('.deployment.buildSourceSha == $sha');
    expect(workflow).toContain('.deployment.imageDigest == $digest');
    expect(workflow).toContain('.checks.db == true');
    expect(workflow).toContain('.checks.automationDb == true');
    expect(workflow).toContain('.checks.automationEngine == true');
    expect(workflow).toContain('.readiness.database.ok == true');
    expect(workflow).toContain('.readiness.automationDatabase.ok == true');
    expect(workflow).toContain('.readiness.deploymentIdentityOk == true');
    expect(workflow).toContain('.readiness.automationEngine.ok == true');
  });

  it('preserves sanitized readiness diagnostics when production proof fails', () => {
    expect(workflow).toContain('SANITIZED_READINESS_DIAGNOSTIC:');
    expect(workflow).toContain('production-readiness-diagnostics.json');
    expect(workflow).toContain('dsg-one-production-readiness-diagnostics-${{ env.SOURCE_SHA }}');
    expect(workflow).toContain('automationDatabase: .readiness.automationDatabase');
    expect(workflow).not.toContain('DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY');
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

  it('restores the previous image and deployment identity on rollback', () => {
    expect(workflow).toContain('previous_source_sha=$PREVIOUS_SOURCE_SHA');
    expect(workflow).toContain('previous_image_digest=$PREVIOUS_IMAGE_DIGEST');
    expect(workflow).toContain('RESTORE_SETTINGS+=("DSG_DEPLOYED_SOURCE_SHA=$PREVIOUS_SOURCE_SHA")');
    expect(workflow).toContain('RESTORE_SETTINGS+=("DSG_DEPLOYED_IMAGE_DIGEST=$PREVIOUS_IMAGE_DIGEST")');
    expect(workflow).toContain('--setting-names "${DELETE_SETTINGS[@]}"');
    expect(workflow).toContain('steps.image.outputs.previous_image');
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
