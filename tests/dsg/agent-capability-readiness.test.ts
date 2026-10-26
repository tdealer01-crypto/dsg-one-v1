import { describe, expect, it } from 'vitest';
import { agentCapabilityReadiness } from '@/lib/dsg/user-bound/agent-capability-readiness';
import type { WorkroomRoute } from '@/lib/dsg/user-bound/workroom-contract';

function route(capability: string, target_node: string, source_node = 'node.core-spin'): WorkroomRoute {
  return {
    route_id: 'route.' + capability,
    capability, target_node, source_node,
    approval_required: false, signed_approval_required: false, bind_payload: false,
  };
}

describe('truthful existing DSG agent capability readiness', () => {
  it('distinguishes a registered route from a running model or a verified outcome', () => {
    const rows = agentCapabilityReadiness([
      route('action.plan', 'node.agent.dsg-v0'),
      route('dsg.one.mcp.physics.ising.strategy', 'node.dsg-one-v1'),
      route('repair.evaluate', 'node.repair-kernel'),
    ]);
    for (const id of ['core-spin', 'brain', 'physics-strategy', 'repair-evaluate']) {
      expect(rows.find(row => row.id === id)?.registered).toBe(true);
    }
    for (const id of ['physics-selector', 'repair-synthesize', 'memory']) {
      expect(rows.find(row => row.id === id)?.registered).toBe(false);
    }
    expect(rows.find(row => row.id === 'brain')?.detail).toContain('ไม่รับประกัน');
  });

  it('does not mistake a route to a different target for memory or repair availability', () => {
    const rows = agentCapabilityReadiness([
      route('memory.lifecycle', 'node.agent.dsg-v0'),
      route('repair.synthesize', 'node.repair-kernel'),
    ]);
    expect(rows.find(row => row.id === 'memory')?.registered).toBe(false);
    expect(rows.find(row => row.id === 'repair-synthesize')?.registered).toBe(false);
  });

  it('reflects future actual routes only after discovery', () => {
    const rows = agentCapabilityReadiness([route('memory.lifecycle', 'node.memory.aws')]);
    expect(rows.find(row => row.id === 'memory')?.registered).toBe(true);
    expect(rows.find(row => row.id === 'brain')?.registered).toBe(false);
  });
});
