import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCandidateServiceRequest } from '../../lib/dsg/server/app-builder/candidate-service-context';

const BODY = JSON.stringify({ spec: { candidateId: 'candidate-1' } });
const SECRET = 'candidate-intake-unit-secret';
const ENV = {
  NODE_ENV: 'test',
  DSG_BUILDER_CANDIDATE_INTAKE_SECRET: SECRET,
  DSG_BUILDER_SERVICE_ACTOR_ID: 'github-actions:dsg-agi-simulation',
  DSG_BUILDER_SERVICE_WORKSPACE_ID: '11111111-1111-1111-1111-111111111111',
};

function signature(body = BODY) {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

describe('candidate service intake authentication', () => {
  it('returns null when the caller did not request service authentication', () => {
    expect(verifyCandidateServiceRequest(BODY, null, ENV)).toBeNull();
  });

  it('accepts an exact HMAC body binding and returns the configured service identity', () => {
    expect(verifyCandidateServiceRequest(BODY, signature(), ENV)).toEqual({
      actorId: 'github-actions:dsg-agi-simulation',
      workspaceId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('rejects a signature after the body changes', () => {
    expect(() => verifyCandidateServiceRequest(`${BODY}\n`, signature(), ENV)).toThrow(
      'DSG_BUILDER_CANDIDATE_INTAKE_SIGNATURE_INVALID',
    );
  });

  it('fails closed when the intake secret is not configured', () => {
    expect(() => verifyCandidateServiceRequest(BODY, signature(), {
      NODE_ENV: 'test',
      DSG_BUILDER_SERVICE_ACTOR_ID: ENV.DSG_BUILDER_SERVICE_ACTOR_ID,
      DSG_BUILDER_SERVICE_WORKSPACE_ID: ENV.DSG_BUILDER_SERVICE_WORKSPACE_ID,
    })).toThrow('DSG_BUILDER_CANDIDATE_INTAKE_NOT_CONFIGURED');
  });

  it('fails closed when the service identity is not configured', () => {
    expect(() => verifyCandidateServiceRequest(BODY, signature(), {
      NODE_ENV: 'test',
      DSG_BUILDER_CANDIDATE_INTAKE_SECRET: SECRET,
    })).toThrow('DSG_BUILDER_CANDIDATE_SERVICE_IDENTITY_NOT_CONFIGURED');
  });
});
