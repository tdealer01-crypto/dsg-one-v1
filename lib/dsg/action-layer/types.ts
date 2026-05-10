export type DsgActionFlow =
  | 'command_center'
  | 'live_reasoning'
  | 'governance_vault'
  | 'telemetry'
  | 'app_builder'
  | 'flow_studio'
  | 'autonomous_gate'
  | 'governed_tool'
  | 'proof_timeline';

export type DsgActionIntent =
  | 'assign_task'
  | 'run_governance_audit'
  | 'run_market_analysis'
  | 'run_process_automation'
  | 'generate_plan'
  | 'create_job'
  | 'generate_prd'
  | 'create_handoff'
  | 'runtime_gate'
  | 'safe_navigate'
  | 'wikipedia_extract'
  | 'prepare'
  | 'execute'
  | 'evaluate'
  | 'append'
  | 'verify'
  | 'export';

export type DsgActionMode = 'DRY_RUN' | 'EXECUTE' | 'BLOCKED';
export type DsgActionRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type DsgActionStatus = 'READY' | 'RUNNING' | 'PASS' | 'PARTIAL' | 'BLOCKED' | 'FAILED';

export type DsgActionActor = {
  actorId: string;
  workspaceId: string;
  permissions: string[];
};

export type DsgActionContract = {
  actionId: string;
  flow: DsgActionFlow;
  intent: DsgActionIntent;
  mode: DsgActionMode;
  risk: DsgActionRisk;
  actor: DsgActionActor;
  inputHash: string;
  requiredProof: string[];
  createdAt: string;
  claim: string;
};

export type DsgActionResult = {
  ok: boolean;
  actionId: string;
  flow: DsgActionFlow;
  intent: DsgActionIntent;
  status: DsgActionStatus;
  claim: string;
  proofHash: string;
  blockedReasons: string[];
  nextAction: string;
  timeline: DsgActionTimelineEvent[];
};

export type DsgActionTimelineEvent = {
  id: string;
  at: string;
  kind: 'input' | 'contract' | 'route' | 'proof' | 'result';
  title: string;
  detail: string;
  proofHash: string;
};

export type DsgActionLayerSnapshot = {
  claim: 'DSG_ACTION_LAYER_READY' | 'DSG_ACTION_LAYER_COMPLETE';
  complete: boolean;
  activeFlow: DsgActionFlow;
  liveExecutionCapacity: '03:00.00';
  lanes: Array<{
    id: DsgActionFlow;
    label: string;
    status: DsgActionStatus;
    detail: string;
  }>;
  recentActions: DsgActionResult[];
  proofHash: string;
};
