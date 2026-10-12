// User-facing text for the workspace/session screens. Pure so every branch can be unit-tested.
// The raw server body is never shown: an error string from a route is not a next step for the user.

/** `status` is the HTTP status, or null when the request never reached the server. */
export function sessionLoadFailure(status: number | null): string {
  return status === null
    ? 'โหลดเซสชันไม่สำเร็จ — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบเครือข่ายแล้วกด Refresh'
    : `โหลดเซสชันไม่สำเร็จ (HTTP ${status}) — กด Refresh หรือเข้าสู่ระบบใหม่`;
}

export function workspaceActivationFailure(status: number | null): string {
  if (status === null) return 'เปิดใช้งาน workspace ไม่สำเร็จ — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กดเลือก workspace อีกครั้งเมื่อเครือข่ายพร้อม';
  if (status === 403) return 'เปิดใช้งาน workspace ไม่สำเร็จ (HTTP 403) — บัญชีนี้ไม่ได้เป็นสมาชิกของ workspace นี้ ให้เลือก workspace อื่นหรือขอสิทธิ์จากเจ้าของ';
  if (status === 401) return 'เปิดใช้งาน workspace ไม่สำเร็จ (HTTP 401) — เซสชันหมดอายุ กด Refresh เพื่อเข้าสู่ระบบใหม่';
  return `เปิดใช้งาน workspace ไม่สำเร็จ (HTTP ${status}) — กดเลือก workspace อีกครั้ง หากยังไม่ได้ให้ติดต่อผู้ดูแลระบบ`;
}

export const SESSION_READY = 'เซสชันพร้อมใช้งาน — workspace ถูกเลือกแล้ว';
export const SESSION_NEEDS_WORKSPACE = 'เลือก workspace เพื่อเปิดใช้งานเครื่องมือที่ควบคุมโดย governance';
export const SESSION_LOADING = 'กำลังโหลดเซสชัน…';
