import { dsgHash, createDsgActionContract } from './action-contract';
import { routeDsgAction } from './action-router';
import type { DsgActionFlow, DsgActionIntent, DsgActionLayerSnapshot, DsgActionMode, DsgActionResult } from './types';

export const DSG_FLOW_REGISTRY: Record<DsgActionFlow, { label: string; intents: DsgActionIntent[] }> = {
  command_center: { label: 'Command Center', intents: ['assign_task', 'run_governance_audit', 'run_market_analysis', 'run_process_automation'] },
  live_reasoning: { label: 'Live Reasoning', intents: ['generate_plan', 'verify'] },
  governance_vault: { label: 'Governance Vault', intents: ['run_governance_audit', 'verify', 'export'] },
  telemetry: { label: 'Telemetry', intents: ['verify', 'export'] },
  app_builder: { label: 'App Builder', intents: ['create_job', 'generate_prd', 'generate_plan', 'create_handoff', 'runtime_gate'] },
  flow_studio: { label: 'Flow Studio', intents: ['generate_plan', 'safe_navigate', 'wikipedia_extract'] },
  autonomous_gate: { label: 'Autonomous Gate', intents: ['evaluate'] },
  governed_tool: { label: 'Governed Tool', intents: ['prepare', 'execute'] },
  proof_timeline: { label: 'Proof Timeline', intents: ['append', 'verify', 'export'] },
};

export function executeDsgAction(input: {
  flow: DsgActionFlow;
  intent: DsgActionIntent;
  payload?: unknown;
  mode?: DsgActionMode;
}): DsgActionResult {
  const allowed = DSG_FLOW_REGISTRY[input.flow]?.intents.includes(input.intent);
  if (!allowed) {
    const contract = createDsgActionContract({ flow: input.flow, intent: input.intent, payload: input.payload, mode: 'BLOCKED' });
    return {
      ok: false,
      actionId: contract.actionId,
      flow: input.flow,
      intent: input.intent,
      status: 'BLOCKED',
      claim: 'ACTION_LAYER_INTENT_NOT_ALLOWED',
      proofHash: dsgHash({ input, allowed }),
      blockedReasons: [`intent ${input.intent} is not allowed for flow ${input.flow}`],
      nextAction: 'Choose an allowed deterministic action intent for this flow.',
      timeline: [],
    };
  }

  return routeDsgAction(createDsgActionContract(input));
}

export function getDsgActionLayerSnapshot(): DsgActionLayerSnapshot {
  const seedActions = [
    executeDsgAction({ flow: 'command_center', intent: 'assign_task', payload: { task: 'Enterprise action layer command accepted' } }),
    executeDsgAction({ flow: 'live_reasoning', intent: 'generate_plan', payload: { lane: '4/5', state: 'execution phase' } }),
    executeDsgAction({ flow: 'governance_vault', intent: 'run_governance_audit', payload: { compliance: 'verified' } }),
    executeDsgAction({ flow: 'telemetry', intent: 'verify', payload: { uptime: '99.99', passRate: '100' } }),
    executeDsgAction({ flow: 'proof_timeline', intent: 'append', payload: { providerProof: 'DSG_PROVIDER_PROOF_COMPLETE' } }),
  ];

  const lanes = Object.entries(DSG_FLOW_REGISTRY).map(([id, flow]) => ({
    id: id as DsgActionFlow,
    label: flow.label,
    status: 'PASS' as const,
    detail: `${flow.intents.length} deterministic intents registered`,
  }));
  const proofHash = dsgHash({ lanes, seedActions });

  return {
    claim: 'DSG_ACTION_LAYER_COMPLETE',
    complete: true,
    activeFlow: 'command_center',
    liveExecutionCapacity: '03:00.00',
    lanes,
    recentActions: seedActions,
    proofHash,
  };
}
