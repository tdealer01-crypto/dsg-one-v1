export type FlowThoughtCategory = 'info' | 'capability' | 'limitation' | 'suggestion';

export type FlowThought = {
  id: string;
  category: FlowThoughtCategory;
  message: string;
};

export type FlowToolStatus = 'available' | 'missing' | 'requires_auth' | 'blocked';

export type FlowPlan = {
  goal: { text: string; constraints: string[] };
  processedInput: {
    raw: string;
    extractedEntities: Record<string, string[]>;
    identifiedIntents: string[];
    missingRequirements: string[];
  };
  toolsRequired: { id: string; name: string; purpose: string; status: FlowToolStatus }[];
  architecture: { systems: { name: string; role: string }[]; flowSummary: string[] };
  stages: {
    id: string;
    title: string;
    purpose: string;
    type: 'inspect' | 'decide' | 'execute' | 'verify';
    externalBoundary: boolean;
    approvalRequired: boolean;
  }[];
  risks: { level: 'low' | 'medium' | 'high'; title: string; impact: string; mitigation: string }[];
  permissions: { target: string; decision: 'allow' | 'needs_user_takeover' | 'deny'; reason: string; userNextStep?: string }[];
  definitionOfSuccess: { outcomes: string[]; evidence: string[] };
};

export type FlowExecution = {
  runStatus: { state: 'draft' | 'ready_for_approval' | 'approved' | 'running' | 'blocked' | 'completed' | 'failed'; summary: string };
  currentGoal: { text: string };
  currentStage: { id: string; title: string; state: 'pending' | 'running' | 'completed' | 'blocked' | 'failed' | 'skipped'; summary: string };
  stageList: { id: string; title: string; state: 'pending' | 'running' | 'completed' | 'blocked' | 'failed' | 'skipped'; evidenceHint: string }[];
  evidence: { type: 'page_state' | 'status_label' | 'confirmation' | 'artifact' | 'log_excerpt'; title: string; detail: string }[];
  checkpoints: { type: 'external_app' | 'login' | 'consent' | 'takeover' | 'privileged_action' | 'input_required'; state: 'pending' | 'active' | 'resolved'; instruction: string; inputPlaceholder?: string }[];
  nextAction: { owner: 'studio' | 'user'; instruction: string };
};

export type FlowOrchestration = {
  thoughts: FlowThought[];
  plan: FlowPlan;
};
