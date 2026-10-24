import { NextRequest, NextResponse } from 'next/server';
import { DSG_AUTH0_CLIENT_ID, DSG_AUTH0_ISSUER } from '@/lib/dsg/server/auth0-identity';
import { evaluateReviewerPreflight } from '@/lib/dsg/server/reviewer-preflight';
import { getDsgSupabaseRpcConfig, readDsgRest } from '@/lib/dsg/server/supabase-rpc';

export const dynamic = 'force-dynamic';

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { 'cache-control': 'no-store' };
type User = { id?: string; email?: string; email_confirmed_at?: string | null };
type Member = { actor_id: string; workspace_id: string; role: string };
type Invite = { email: string; workspace_id: string | null; purpose: string; role: string; status: string; expires_at: string | null };
type Link = { actor_id: string; auth0_sub: string; auth0_issuer: string; auth0_client_id: string; verified_at: string };
type Workspace = { id: string; metadata: unknown };

export async function GET(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token || token.length > 15000) {
    return NextResponse.json({ status: 'BLOCKED', reason: 'DSG_SIGN_IN_REQUIRED' }, { status: 401, headers: noStore });
  }
  const workspaceId = request.cookies.get('dsg-workspace-id')?.value || '';
  if (!WORKSPACE_UUID.test(workspaceId)) {
    return NextResponse.json({ status: 'BLOCKED', reason: 'WORKSPACE_SELECTION_REQUIRED' }, { status: 403, headers: noStore });
  }
  try {
    // Never silently fall back to an unrelated Supabase project or publishable key.
    const expectedUrl = process.env.DSG_ONE_V1_SUPABASE_URL?.replace(/\/+$/, '');
    const expectedKey = process.env.DSG_ONE_V1_SUPABASE_SERVICE_ROLE_KEY;
    if (!expectedUrl || !expectedKey || (expectedKey.startsWith('sb_') && !expectedKey.startsWith('sb_secret_'))) {
      throw new Error('REVIEWER_DB_BINDING_REQUIRED');
    }
    const config = getDsgSupabaseRpcConfig();
    if (config.url !== expectedUrl || config.key !== expectedKey) throw new Error('REVIEWER_DB_BINDING_MISMATCH');
    const response = await fetch(config.url + '/auth/v1/user', {
      headers: { apikey: config.key, Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(5000), cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ status: 'BLOCKED', reason: 'DSG_IDENTITY_NOT_VERIFIED' }, { status: 401, headers: noStore });
    }
    const user = await response.json() as User;
    if (!user.id || !user.email || !user.email_confirmed_at) {
      return NextResponse.json({ status: 'BLOCKED', reason: 'VERIFIED_REVIEWER_REQUIRED' }, { status: 403, headers: noStore });
    }
    const email = user.email.trim().toLowerCase();
    // Every query is constrained to the verified actor, workspace and email.
    const [memberships, invitations, links, workspaces] = await Promise.all([
      readDsgRest<Member[]>(config, 'dsg_workspace_members', {
        actor_id: 'eq.' + user.id, workspace_id: 'eq.' + workspaceId,
        select: 'actor_id,workspace_id,role', limit: '2',
      }, { timeoutMs: 5000 }),
      readDsgRest<Invite[]>(config, 'dsg_access_invites', {
        email: 'eq.' + email, workspace_id: 'eq.' + workspaceId,
        purpose: 'eq.chatgpt_full_system_review',
        select: 'email,workspace_id,purpose,role,status,expires_at', limit: '2',
      }, { timeoutMs: 5000 }),
      readDsgRest<Link[]>(config, 'dsg_auth0_identity_links', {
        actor_id: 'eq.' + user.id,
        select: 'actor_id,auth0_sub,auth0_issuer,auth0_client_id,verified_at', limit: '2',
      }, { timeoutMs: 5000 }),
      readDsgRest<Workspace[]>(config, 'dsg_workspaces', {
        id: 'eq.' + workspaceId, select: 'id,metadata', limit: '2',
      }, { timeoutMs: 5000 }),
    ]);
    const verdict = evaluateReviewerPreflight({
      actorId: user.id, email, emailConfirmed: true, workspaceId,
      memberships, invitations, links, workspaces,
      expectedIssuer: DSG_AUTH0_ISSUER, expectedClient: DSG_AUTH0_CLIENT_ID,
      now: Date.now(),
    });
    return NextResponse.json(verdict, {
      status: verdict.status === 'PREFLIGHT_ELIGIBLE' ? 200 : 403,
      headers: noStore,
    });
  } catch {
    return NextResponse.json({ status: 'BLOCKED', reason: 'REVIEWER_PREFLIGHT_BACKEND_UNAVAILABLE' }, {
      status: 503, headers: noStore,
    });
  }
}
