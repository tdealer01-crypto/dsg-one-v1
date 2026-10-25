// Actionable, bounded error copy; never claim that a failed provider executed.
// Credentials, tokens, MFA codes, and internal endpoints are never shown.
const known: Record<string, string> = {
  HUMAN_APPROVAL_NOT_READY: 'คำขอเดิมยังไม่ได้รับ Signed Approval จากเจ้าของ · เปิดรายการอนุมัติเดิม ไม่ต้องสร้างคำขอซ้ำ',
  APPROVAL_PENDING: 'คำขอเดิมรออนุมัติ · เปิดรายการเดิมแล้วกลับมาทำงานต่อ ไม่ต้องส่งงานใหม่',
  FINISH_OR_CANCEL_PENDING_REQUEST_FIRST: 'มีงานรออนุมัติอยู่แล้ว · ทำงานเดิมให้เสร็จหรือยกเลิกก่อนเริ่มงานใหม่',
  DSG_NATIVE_DESKTOP_NOT_ENROLLED: 'DSG Native ยังไม่ได้จับคู่กับ Workspace นี้ · ตรวจสถานะและจับคู่เครื่องจริงก่อน',
  AUTH0_REAUTH_REQUIRED: 'เซสชัน Auth0 หมดอายุจริง · ใช้ปุ่มเข้าสู่ระบบเครื่องมือหนึ่งครั้ง แล้วกลับมางานเดิม',
  AUTH0_TOKEN_UNAVAILABLE: 'ยังไม่ได้รับสิทธิ์เครื่องมือ Auth0 · ตรวจบัญชีที่เชื่อม ไม่ต้องยืนยันเจ้าของซ้ำ',
  DSG_WORKSPACE_SESSION_REQUIRED: 'ไม่พบเซสชัน DSG ONE ที่เลือก Workspace · เปิดหน้าบัญชีและพื้นที่ทำงาน',
  DSG_BRAIN_BASE_URL_INVALID: 'DSG Agent v0 ยังเรียกโมเดลจริงไม่ได้ · ตรวจ Kaggle Worker ก่อน ไม่เปิด GPU เสียเงิน',
  CINEMA_ACTION_NOT_ALLOWED: 'คำสั่ง Browser ไม่ตรงสัญญา Cinema · ต้องแก้ Route/Payload ไม่ใช่อนุมัติซ้ำ',
  CINEMA_CONNECT_NOT_VERIFIED: 'Cinema ยังไม่ยืนยัน Shared Browser และ Agent ในเซสชันเดียวกัน · ไม่สั่งเปิดเว็บต่อ',
  CINEMA_VERIFIER_POSTCONDITION_NOT_VERIFIED: 'Verifier ยังไม่ยืนยันหน้าเว็บตรงกับแผนและหลักฐาน · ตรวจหน้าเดิมก่อน ไม่สั่งเปิดเว็บหรืออนุมัติใหม่ซ้ำ',
  ROUTE_NOT_AVAILABLE_OR_AMBIGUOUS: 'Runtime ยังไม่พบ Route ที่ตรงงานแบบชัดเจน · ตรวจการเชื่อม Provider',
  EXACT_PROVIDER_RECEIPT_NOT_VERIFIED: 'Provider ยังไม่มีหลักฐานตรงกับคำสั่งที่อนุมัติ · ไม่สั่งซ้ำจนกว่าจะตรวจผล',
  EVIDENCE_CHAIN_NOT_VERIFIED: 'ตรวจสายหลักฐานไม่ผ่าน · ไม่ยืนยันว่าทำงานสำเร็จ',
};

export function describeWorkroomFailure(value: unknown): string {
  const code = value instanceof Error ? value.message : '';
  const normalized = code.startsWith('EXECUTION_FAILED:') ? code.slice('EXECUTION_FAILED:'.length) : code;
  if (Object.prototype.hasOwnProperty.call(known, normalized)) return known[normalized];
  if (/^CINEMA_(HTTP_5\d{2}|TIMEOUT|NETWORK_ERROR|DNS_ERROR)$/.test(normalized))
    return 'เชื่อม Cinema Provider ไม่ได้ · ตรวจสถานะ Provider และเครือข่าย ไม่สร้างคำขออนุมัติใหม่';
  if (/^AUTH0_[A-Z0-9_]+$/.test(normalized))
    return 'Session Auth0 ไม่พร้อม · ตรวจสิทธิ์เครื่องมือก่อนดำเนินงาน';
  // Do not echo unbounded provider strings which may contain private data.
  return 'งานยังไม่ผ่านการตรวจ · เปิดรายละเอียดผล Provider/Evidence แล้วตรวจสาเหตุ ไม่ส่งคำสั่งซ้ำ';
}

