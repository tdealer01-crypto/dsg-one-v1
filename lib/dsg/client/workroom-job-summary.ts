/** Read-only view model. Does not perform provider/evidence signature verification. */
export type WorkroomTimelineData = {
  job?: { id?: unknown; status?: unknown; goal?: unknown; completionReportId?: unknown };
  events?: unknown;
  evidenceItems?: unknown;
  evidenceManifests?: unknown;
  replayProofs?: unknown;
  completionReports?: unknown;
};

export type WorkroomJobSummary = {
  status: string;
  events: number;
  evidenceItems: number;
  evidenceManifests: number;
  replayProofs: number;
  completionReports: number;
  verified: false;
  userMessage: string;
  nextAction: string;
};

const count = (value: unknown): number => Array.isArray(value) ? value.length : 0;

export function summarizeWorkroomTimeline(value: WorkroomTimelineData): WorkroomJobSummary {
  const status = typeof value.job?.status === 'string' ? value.job.status.toUpperCase() : 'UNKNOWN';
  const events = count(value.events);
  const evidenceItems = count(value.evidenceItems);
  const evidenceManifests = count(value.evidenceManifests);
  const replayProofs = count(value.replayProofs);
  const completionReports = count(value.completionReports);
  const awaitingApproval = status.includes('APPROV');
  const finished = ['COMPLETED', 'COMPLETE', 'SUCCESS', 'SUCCEEDED', 'PASSED'].includes(status);
  const failed = ['FAILED', 'BLOCKED', 'REJECTED', 'CANCELLED'].includes(status);
  return {
    status, events, evidenceItems, evidenceManifests, replayProofs, completionReports,
    verified: false,
    userMessage: completionReports > 0
      ? 'พบรายงานผลจากฐานข้อมูลงาน (ยังไม่ได้ตรวจลายเซ็นหลักฐาน)'
      : finished
        ? 'Backend แจ้งว่างานเสร็จ แต่ยังไม่พบรายงานผลยืนยัน'
        : awaitingApproval
          ? 'งานกำลังรอการอนุมัติตามสิทธิ์ของผู้ใช้'
          : failed
            ? 'Backend แจ้งว่างานไม่ผ่านหรือถูกหยุด'
            : 'ยังไม่มีรายงานผลสำเร็จจาก Backend',
    nextAction: awaitingApproval
      ? 'ตรวจคำขอในหน้าอนุมัติ โดยระบบยังต้องตรวจสิทธิ์และ MFA ตามนโยบาย'
      : failed
        ? 'ตรวจเหตุการณ์ล่าสุดและสาเหตุจาก Backend ก่อนสั่งงานซ้ำ'
        : finished && completionReports === 0
          ? 'ตรวจการสร้าง Completion Report และหลักฐานจาก Provider'
          : completionReports > 0
            ? 'ตรวจรายงานผลและหลักฐานแบบลงลายเซ็นผ่านระบบตรวจสอบเดิม'
            : 'รีเฟรชผลจากเซิร์ฟเวอร์ หรือรอให้ระบบมีหลักฐานการทำงานจริง',
  };
}

/** Display only selected human-readable fields; never serialize provider payloads. */
export function safeWorkroomEventSummary(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'เหตุการณ์จาก Backend';
  const record = value as Record<string, unknown>;
  for (const key of ['summary', 'event_type', 'type', 'status']) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.slice(0, 180);
  }
  return 'เหตุการณ์จาก Backend (ไม่มีคำอธิบายที่แสดงได้)';
}
