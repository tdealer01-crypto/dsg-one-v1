/** Source-only ChatGPT reviewer preflight: never an execution permit. */
export const REVIEW_PURPOSE = 'chatgpt_full_system_review';

export type ReviewerPreflightInput = {
  actorId: string;
  email: string;
  emailConfirmed: boolean;
  workspaceId: string;
  memberships: Array<{ actor_id: string; workspace_id: string; role: string }>;
  invitations: Array<{
    email: string;
    workspace_id: string | null;
    purpose: string;
    role: string;
    status: string;
    expires_at: string | null;
  }>;
  links: Array<{
    actor_id: string;
    auth0_sub: string;
    auth0_issuer: string;
    auth0_client_id: string;
    verified_at: string;
  }>;
  workspaces: Array<{ id: string; metadata: unknown }>;
  expectedIssuer: string;
  expectedClient: string;
  now: number;
};

export type ReviewerPreflightResult = {
  status: 'PREFLIGHT_ELIGIBLE' | 'BLOCKED';
  reason: string;
  next: string;
  executionEnabled: false;
  productionAccessGranted: false;
  resourceIsolationE2E: 'NOT_VERIFIED';
  chatgptOAuthSessionE2E: 'NOT_VERIFIED';
};

function blocked(reason: string, next: string): ReviewerPreflightResult {
  return {
    status: 'BLOCKED', reason, next,
    executionEnabled: false, productionAccessGranted: false,
    resourceIsolationE2E: 'NOT_VERIFIED', chatgptOAuthSessionE2E: 'NOT_VERIFIED',
  };
}

export function evaluateReviewerPreflight(input: ReviewerPreflightInput): ReviewerPreflightResult {
  if (!input.actorId || !input.emailConfirmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return blocked('REVIEWER_VERIFIED_IDENTITY_REQUIRED', 'Confirm the actual DSG ONE account email.');
  }
  const member = input.memberships.filter(row => row.actor_id === input.actorId && row.workspace_id === input.workspaceId);
  if (member.length !== 1 || member[0].role !== 'AUDITOR') {
    return blocked('REVIEWER_WORKSPACE_MEMBERSHIP_REQUIRED', 'Owner must invite the reviewer as AUDITOR in a dedicated reviewer workspace.');
  }
  const email = input.email.trim().toLowerCase();
  const invites = input.invitations.filter(row =>
    row.email.trim().toLowerCase() === email && row.workspace_id === input.workspaceId &&
    row.purpose === REVIEW_PURPOSE && row.role === 'AUDITOR' && row.status === 'active' &&
    typeof row.expires_at === 'string' && Number.isFinite(Date.parse(row.expires_at)) &&
    Date.parse(row.expires_at) > input.now,
  );
  if (invites.length !== 1) {
    return blocked('REVIEWER_INVITE_REQUIRED', 'Owner must issue a time-limited ChatGPT reviewer invitation for this exact workspace.');
  }
  const links = input.links.filter(row =>
    row.actor_id === input.actorId && row.auth0_sub.length > 0 &&
    row.auth0_issuer === input.expectedIssuer &&
    row.auth0_client_id === input.expectedClient &&
    Number.isFinite(Date.parse(row.verified_at)),
  );
  if (links.length !== 1 || input.links.length !== 1) {
    return blocked('REVIEWER_AUTH0_ACCOUNT_LINK_REQUIRED', 'Verify and persist the exact Auth0-to-DSG actor link. Email alone is not a link.');
  }
  if (input.workspaces.length !== 1 || input.workspaces[0].id !== input.workspaceId) {
    return blocked('REVIEWER_SANDBOX_WORKSPACE_MISSING', 'Provision a distinct reviewer workspace.');
  }
  const meta = input.workspaces[0].metadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta) ||
      (meta as Record<string, unknown>).purpose !== REVIEW_PURPOSE) {
    return blocked('REVIEWER_SANDBOX_NOT_DECLARED', 'Tag a separately provisioned workspace with the review purpose. This is not proof of resource isolation.');
  }
  return {
    status: 'PREFLIGHT_ELIGIBLE',
    reason: 'IDENTITY_AND_INVITE_CHECKS_PASSED_EXECUTION_NOT_GRANTED',
    next: 'Verify ChatGPT OAuth with this reviewer account, provider-backed sandbox isolation, and full independent E2E before enabling execution.',
    executionEnabled: false,
    productionAccessGranted: false,
    resourceIsolationE2E: 'NOT_VERIFIED',
    chatgptOAuthSessionE2E: 'NOT_VERIFIED',
  };
}
