import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCandidateServiceRequest } from '../../lib/dsg/server/app-builder/candidate-service-context';

const BODY = JSON.stringify({ spec: { candidateId: 'candidate-1' } });
const SECRET = 'candidate-intake-unit-secret';
const TIMESTAMP = '2026-08-31T07:00:00.000Z';
const NOW = Date.parse(TIMESTAMP);
const ENV = {
  NODE_ENV: 'test',
  DSG_BUILDER_CANDIDATE_INTAKE_SECRET: SECRET,
  DSG_BUILDER_SERVICE_ACTOR_ID: 'github-actions:dsg-agi-simulation',
  DSG_BUILDER_SERVICE_WORKSPACE_ID: '11111111-1111-1111-1111-111111111111',
};

function signature(body = BODY, timestamp = TIMESTAMP) {
  return `sha256=${createHmac('sha256', SECRET).update(`${timestamp}\n${body}`).digest('hex')}`;
}

describe('candidate service intake authentication', () => {
  it('returns null when the caller did not request service authentication', () => {
    expect(verifyCandidateServiceRequest(BODY, null, null, ENV, NOW)).toBeNull();
  });

  it('accepts an exact timestamp + body HMAC binding and returns the configured service identity', () => {
    expect(verifyCandidateServiceRequest(BODY, signature(), TIMESTAMP, ENV, NOW)).toEqual({
      actorId: 'github-actions:dsg-agi-simulation',
      workspaceId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('rejects a signature after the body changes', () => {
    expect(() => verifyCandidateServiceRequest(`${BODY}\n`, signature(), TIMESTAMP, ENV, NOW)).toThrow(
      'DSG_BUILDER_CANDIDATE_INTAKE_SIGNATURE_INVALID',
    );
  });

  it('rejects a signed request outside the five-minute freshness window', () => {
    const staleNow = NOW + (5 * 60 * 1000) + 1;
    expect(() => verifyCandidateServiceRequest(BODY, signature(), TIMESTAMP, ENV, staleNow)).toThrow(
      'DSG_BUILDER_CANDIDATE_INTAKE_TIMESTAMP_STALE',
    );
  });

  it('fails closed when the intake secret is not configured', () => {
    expect(() => verifyCandidateServiceRequest(BODY, signature(), TIMESTAMP, {
      NODE_ENV: 'test',
      DSG_BUILDER_SERVICE_ACTOR_ID: ENV.DSG_BUILDER_SERVICE_ACTOR_ID,
      DSG_BUILDER_SERVICE_WORKSPACE_ID: ENV.DSG_BUILDER_SERVICE_WORKSPACE_ID,
    }, NOW)).toThrow('DSG_BUILDER_CANDIDATE_INTAKE_NOT_CONFIGURED');
  });

  it('fails closed when the service identity is not configured', () => {
    expect(() => verifyCandidateServiceRequest(BODY, signature(), TIMESTAMP, {
      NODE_ENV: 'test',
      DSG_BUILDER_CANDIDATE_INTAKE_SECRET: SECRET,
    }, NOW)).toThrow('DSG_BUILDER_CANDIDATE_SERVICE_IDENTITY_NOT_CONFIGURED');
  });
});
