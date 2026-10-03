export type DelegatedWallet = {
  ownerId: string;
  delegateAgentId: string;
  currency: string;
  availableMinor: number;
  perTransactionLimitMinor: number;
  dailyLimitMinor: number;
  spentTodayMinor: number;
  approvalThresholdMinor: number;
  allowedCategories: string[];
  allowedMerchants: string[];
  expiresAt?: string;
};

export type SpendRequest = {
  ownerId: string;
  agentId: string;
  currency: string;
  amountMinor: number;
  category: string;
  merchantId: string;
};

export type WalletDecision =
  | { verdict: 'ALLOW' }
  | { verdict: 'WAITING_APPROVAL'; reason: string }
  | { verdict: 'BLOCK'; reason: string };

export function evaluateDelegatedSpend(
  wallet: DelegatedWallet,
  request: SpendRequest,
  nowMs = Date.now(),
): WalletDecision {
  const limits = [
    wallet.availableMinor,
    wallet.perTransactionLimitMinor,
    wallet.dailyLimitMinor,
    wallet.spentTodayMinor,
    wallet.approvalThresholdMinor,
  ];
  if (
    !limits.every((value) => Number.isSafeInteger(value) && value >= 0)
    || wallet.spentTodayMinor > wallet.dailyLimitMinor
    || wallet.availableMinor < 0
  ) {
    return { verdict: 'BLOCK', reason: 'INVALID_WALLET_LIMITS' };
  }
  if (!Number.isFinite(nowMs)) {
    return { verdict: 'BLOCK', reason: 'INVALID_EVALUATION_TIME' };
  }
  if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
    return { verdict: 'BLOCK', reason: 'INVALID_AMOUNT' };
  }
  if (wallet.ownerId !== request.ownerId || wallet.delegateAgentId !== request.agentId) {
    return { verdict: 'BLOCK', reason: 'DELEGATION_MISMATCH' };
  }
  if (wallet.currency !== request.currency) {
    return { verdict: 'BLOCK', reason: 'CURRENCY_MISMATCH' };
  }
  if (wallet.expiresAt) {
    const expiryMs = Date.parse(wallet.expiresAt);
    if (!Number.isFinite(expiryMs)) {
      return { verdict: 'BLOCK', reason: 'DELEGATION_EXPIRY_INVALID' };
    }
    if (expiryMs <= nowMs) {
      return { verdict: 'BLOCK', reason: 'DELEGATION_EXPIRED' };
    }
  }
  if (!wallet.allowedCategories.includes(request.category)) {
    return { verdict: 'BLOCK', reason: 'CATEGORY_NOT_ALLOWED' };
  }
  if (
    wallet.allowedMerchants.length > 0
    && !wallet.allowedMerchants.includes(request.merchantId)
  ) {
    return { verdict: 'BLOCK', reason: 'MERCHANT_NOT_ALLOWED' };
  }
  if (request.amountMinor > wallet.availableMinor) {
    return { verdict: 'BLOCK', reason: 'INSUFFICIENT_DELEGATED_BUDGET' };
  }
  if (request.amountMinor > wallet.perTransactionLimitMinor) {
    return { verdict: 'BLOCK', reason: 'PER_TRANSACTION_LIMIT' };
  }
  if (wallet.spentTodayMinor + request.amountMinor > wallet.dailyLimitMinor) {
    return { verdict: 'BLOCK', reason: 'DAILY_LIMIT' };
  }
  if (request.amountMinor > wallet.approvalThresholdMinor) {
    return { verdict: 'WAITING_APPROVAL', reason: 'APPROVAL_THRESHOLD' };
  }
  return { verdict: 'ALLOW' };
}

export type ProviderCapability = {
  providerId: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNVERIFIED';
  operations: string[];
  routeId: string;
  evidenceType: string;
  authBinding: 'SERVER_SIDE' | 'NONE';
};

export function selectProviderCapability(
  providers: ProviderCapability[],
  providerId: string,
  operation: string,
): ProviderCapability | undefined {
  return providers.find((provider) =>
    provider.providerId === providerId
    && provider.status === 'AVAILABLE'
    && provider.operations.includes(operation)
    && Boolean(provider.routeId)
    && Boolean(provider.evidenceType),
  );
}

export type CanonicalWorldEventInput = {
  sequence: number;
  logicalTime: string;
  actorId: string;
  missionId: string;
  action: string;
  target: string;
  decisionVerdict: string;
  decisionHash: string;
  executionId: string;
  providerId: string;
  resultDigest: string;
  evidenceHash: string;
  beforeStateHash: string;
  afterStateHash: string;
};

export type CanonicalWorldEvent =
  | { ok: true; event: CanonicalWorldEventInput }
  | { ok: false; reason: string };

export function buildCanonicalWorldEvent(
  input: CanonicalWorldEventInput,
): CanonicalWorldEvent {
  if (input.decisionVerdict !== 'ALLOW') {
    return { ok: false, reason: 'WORLD_COMMIT_REQUIRES_ALLOW' };
  }
  if (!input.decisionHash) {
    return { ok: false, reason: 'WORLD_COMMIT_DECISION_EVIDENCE_REQUIRED' };
  }
  if (!input.executionId || !input.providerId || !input.resultDigest) {
    return { ok: false, reason: 'WORLD_COMMIT_PROVIDER_RESULT_REQUIRED' };
  }
  if (!input.evidenceHash) {
    return { ok: false, reason: 'WORLD_COMMIT_EVIDENCE_REQUIRED' };
  }
  if (!input.beforeStateHash || !input.afterStateHash) {
    return { ok: false, reason: 'WORLD_COMMIT_STATE_HASH_REQUIRED' };
  }
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
    return { ok: false, reason: 'WORLD_COMMIT_SEQUENCE_INVALID' };
  }
  return { ok: true, event: { ...input } };
}

export type AgentMarketMessageType =
  | 'DISCOVER'
  | 'REQUEST_INFO'
  | 'OFFER'
  | 'COUNTER_OFFER'
  | 'PROPOSE_CONTRACT'
  | 'ACCEPT'
  | 'REJECT'
  | 'DELEGATE'
  | 'DELIVER'
  | 'VERIFY'
  | 'SETTLE'
  | 'DISPUTE'
  | 'CANCEL';

export type AgentMarketMessage = {
  messageId: string;
  type: AgentMarketMessageType;
  fromActorId: string;
  toActorId: string;
  contractId?: string;
  exactTermsHash?: string;
  payload: Record<string, unknown>;
};
