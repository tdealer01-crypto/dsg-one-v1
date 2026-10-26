import type { WorkroomRoute } from '@/lib/dsg/user-bound/workroom-contract';

export type AgentFeatureId =
  | 'core-spin' | 'brain' | 'physics-strategy' | 'physics-selector'
  | 'repair-evaluate' | 'repair-synthesize' | 'memory';
export type AgentFeatureReport = {
  id: AgentFeatureId;
  label: string;
  registered: boolean;
  routeId: string | null;
  detail: string;
};

/**
 * A catalog match proves only route registration, never provider health,
 * inference, persistence, or end-to-end user task completion.
 */
export function agentCapabilityReadiness(routes: WorkroomRoute[]): AgentFeatureReport[] {
  const route = (capability: string, target: string) =>
    routes.find(item => item.capability === capability && item.target_node === target);
  const report = (
    id: AgentFeatureId, label: string, capability: string, target: string, detail: string,
  ): AgentFeatureReport => {
    const found = route(capability, target);
    return { id, label, registered: Boolean(found), routeId: found?.route_id ?? null, detail };
  };
  return [
    { ...report('core-spin', 'Core Spin', 'action.plan', 'node.agent.dsg-v0',
      'ตรวจเส้นทางจาก Core Spin; ไม่ใช่หลักฐานว่าจบ Core Spin job'),
      registered: routes.some(item => item.source_node === 'node.core-spin' &&
        item.capability === 'action.plan' && item.target_node === 'node.agent.dsg-v0'),
    },
    report('brain', 'Agent v0 · Qwen Brain', 'action.plan', 'node.agent.dsg-v0',
      'การลงทะเบียนไม่รับประกันว่า Kaggle GPU หรือโมเดลพร้อม infer'),
    report('physics-strategy', 'Physics / Ising Strategy', 'dsg.one.mcp.physics.ising.strategy', 'node.dsg-one-v1',
      'Route สำหรับกลยุทธ์ Ising; ไม่ใช่หลักฐานว่า Physics/Z3 selector ของ Qwen ถูกเปิด'),
    report('physics-selector', 'Physics / Z3 candidate selector', 'candidate.select', 'node.agent.dsg-v0',
      'ตรวจ candidate.select แยกจาก Physics Strategy; ไม่มี Route ห้ามอ้างว่าใช้งานได้'),
    report('repair-evaluate', 'Deterministic Repair Kernel', 'repair.evaluate', 'node.repair-kernel',
      'ใช้ประเมินการซ่อมเท่านั้น; ไม่ใช่การแก้ไขจริงโดยอัตโนมัติ'),
    report('repair-synthesize', 'Repair synthesis', 'repair.synthesize', 'node.agent.dsg-v0',
      'ต้องมี Route ที่ลงทะเบียนจริง; ห้ามใช้โมเดลสร้างสิทธิ์แก้ไขเอง'),
    report('memory', 'Durable Memory', 'memory.lifecycle', 'node.memory.aws',
      'ต้องตรวจ Route และการบันทึก/อ่านกลับจากทรัพยากรจริงก่อนรับรองว่าจำข้ามเซสชัน'),
  ];
}
