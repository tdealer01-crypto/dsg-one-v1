import { createHmac, timingSafeEqual } from 'node:crypto';
import { assertDsgPermission, type DsgServerActor } from '../context';
import type { AppBuilderRequestContext } from './context';
import { supabaseRest } from './supabase-rest';

type Env = Record<string, string | undefined>;
type MembershipRow = { role?: DsgServerActor['role'] };

const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;

export type CandidateServiceIdentity = {
  actorId: string;
  workspaceId: string;
};

function intakeSecret(env: Env): string {
  const value = env.DSG_BUILDER_CANDIDATE_INTAKE_SECRET?.trim();
  if (!value) throw new Error('DSG_BUILDER_CANDIDATE_INTAKE_NOT_CONFIGURED');
  return value;
}

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyCandidateServiceRequest(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  env: Env = process.env,
  nowMs = Date.now(),
): CandidateServiceIdentity | null {
  if (!signatureHeader && !timestampHeader) return null;
  if (!signatureHeader) throw new Error('DSG_BUILDER_CANDIDATE_INTAKE_SIGNATURE_REQUIRED');
  if (!timestampHeader) throw new Error('DSG_BUILDER_CANDIDATE_INTAKE_TIMESTAMP_REQUIRED');

  const issuedAt = Date.parse(timestampHeader);
  if (!Number.isFinite(issuedAt) || Math.abs(nowMs - issuedAt) > MAX_REQUEST_AGE_MS) {
    throw new Error('DSG_BUILDER_CANDIDATE_INTAKE_TIMESTAMP_STALE');
  }

  const supplied = signatureHeader.replace(/^sha256=/i, '').trim();
  const signedPayload = `${timestampHeader}\n${rawBody}`;
  const expected = createHmac('sha256', intakeSecret(env)).update(signedPayload).digest('hex');
  if (!safeEqualHex(supplied, expected)) throw new Error('DSG_BUILDER_CANDIDATE_INTAKE_SIGNATURE_INVALID');

  const actorId = env.DSG_BUILDER_SERVICE_ACTOR_ID?.trim();
  const workspaceId = env.DSG_BUILDER_SERVICE_WORKSPACE_ID?.trim();
  if (!actorId || !workspaceId) throw new Error('DSG_BUILDER_CANDIDATE_SERVICE_IDENTITY_NOT_CONFIGURED');

  return { actorId, workspaceId };
}

export async function getCandidateServiceContext(
  headers: Headers,
  rawBody: string,
  env: Env = process.env,
): Promise<AppBuilderRequestContext | null> {
  const identity = verifyCandidateServiceRequest(
    rawBody,
    headers.get('x-dsg-builder-signature'),
    headers.get('x-dsg-builder-timestamp'),
    env,
  );
  if (!identity) return null;

  const workspace = encodeURIComponent(identity.workspaceId);
  const actor = encodeURIComponent(identity.actorId);
  const rows = await supabaseRest<MembershipRow[]>({
    path: 'dsg_workspace_members',
    query: `?workspace_id=eq.${workspace}&actor_id=eq.${actor}&select=role&limit=1`,
  });
  const role = rows[0]?.role;
  if (!role) throw new Error('DSG_BUILDER_CANDIDATE_SERVICE_MEMBERSHIP_REQUIRED');

  const verified = assertDsgPermission({
    actorId: identity.actorId,
    workspaceId: identity.workspaceId,
    role,
  }, 'job:create');

  return {
    workspaceId: verified.workspaceId,
    actorId: verified.actorId,
    actorRole: verified.role,
    permission: 'job:create',
  };
}
