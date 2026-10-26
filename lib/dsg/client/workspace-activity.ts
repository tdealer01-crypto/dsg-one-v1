export type WorkspaceActivityJob = {
  id: string; goal: string; status: string; completionReportId?: string | null;
  createdAt?: string; updatedAt?: string;
};

export function readWorkspaceJobs(payload: unknown): WorkspaceActivityJob[] {
  if (!payload || typeof payload !== 'object') throw new Error('อ่านรายการงานไม่ได้');
  const body = payload as { ok?: unknown; data?: { jobs?: unknown } };
  if (body.ok !== true || !Array.isArray(body.data?.jobs)) throw new Error('อ่านรายการงานไม่ได้');
  if (body.data.jobs.some(value => !value || typeof value !== 'object' ||
    typeof value.id !== 'string' || !value.id || typeof value.goal !== 'string' || typeof value.status !== 'string')) {
    throw new Error('ข้อมูลรายการงานไม่ครบ กรุณาลองโหลดใหม่');
  }
  return body.data.jobs as WorkspaceActivityJob[];
}

export function activityCategory(job: WorkspaceActivityJob): 'attention' | 'running' | 'reported' | 'pending' {
  const status = job.status.toUpperCase();
  if (/APPROV/.test(status) || ['FAILED', 'BLOCKED', 'REJECTED'].includes(status)) return 'attention';
  if (['RUNNING', 'EXECUTING', 'IN_PROGRESS', 'PROCESSING'].includes(status)) return 'running';
  if (job.completionReportId) return 'reported';
  return 'pending';
}

export function activityStatus(job: WorkspaceActivityJob): string {
  const code = job.status.toUpperCase();
  if (code.includes('APPROV')) return 'รอคุณตัดสินใจ';
  if (['FAILED', 'BLOCKED', 'REJECTED'].includes(code)) return 'ต้องตรวจสาเหตุ';
  if (['CANCELLED', 'CANCELED'].includes(code)) return 'ยกเลิกแล้ว';
  if (activityCategory(job) === 'running') return 'กำลังทำงาน';
  if (job.completionReportId) return 'มีรายงานผล · เปิดตรวจหลักฐาน';
  if (['COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED', 'PASSED'].includes(code)) return 'ระบบรายงานว่าเสร็จ · ยังไม่มีรายงานยืนยัน';
  if (['QUEUED', 'PENDING', 'CREATED', 'DRAFT'].includes(code)) return 'รับงานแล้ว · รอเริ่ม';
  return 'สถานะจากระบบ: ' + (job.status || 'ไม่ทราบ');
}
