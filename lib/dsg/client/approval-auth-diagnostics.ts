/**
 * User-visible Auth0 approval diagnostics.
 * Show only stable, allowlisted codes, never raw callback descriptions,
 * bearer tokens, authorization codes, transaction state, or provider URLs.
 */
export type ApprovalAuthPhase = 'initialize' | 'callback' | 'session' | 'login';

export type ApprovalAuthProblem = {
  code: string;
  explanation: string;
  nextAction: string;
};

function errorField(error: unknown, key: 'name' | 'code' | 'error'): string {
  if (!error || typeof error !== 'object') return '';
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.toLowerCase().slice(0, 100) : '';
}

export function describeApprovalAuthProblem(error: unknown, phase: ApprovalAuthPhase): ApprovalAuthProblem {
  const name = errorField(error, 'name');
  const code = errorField(error, 'code') || errorField(error, 'error');
  const marker = name + ' ' + code;
  if (/missing.transaction|missing_transaction|state.mismatch|state_mismatch|invalid_state|invalid.state/.test(marker)) {
    return {
      code: 'AUTH0_CALLBACK_TRANSACTION_LOST',
      explanation: 'เบราว์เซอร์ไม่พบธุรกรรมล็อกอินที่เริ่มไว้ จึงตรวจ callback ไม่ได้',
      nextAction: 'หยุดการลงชื่อเข้าใช้ซ้ำ เปิดหน้าอนุมัติใน Chrome โปรไฟล์เดียวตลอด Auth0/MFA แล้วเริ่มธุรกรรมใหม่ด้วยการกดยืนยันเพียงครั้งเดียวเมื่อพร้อม',
    };
  }
  if (code === 'login_required' || code === 'interaction_required') {
    return {
      code: 'AUTH0_INTERACTIVE_LOGIN_REQUIRED',
      explanation: 'Auth0 ต้องการให้เข้าสู่ระบบแบบโต้ตอบ',
      nextAction: 'กดเข้าสู่ระบบเพื่ออนุมัติจาก Chrome โดยไม่เปิดหน้าต่างไม่ระบุตัวตน',
    };
  }
  if (code === 'consent_required' || code === 'access_denied' || code === 'unauthorized_client') {
    return {
      code: 'AUTH0_ACCESS_OR_CLIENT_DENIED',
      explanation: 'Auth0 ยังไม่ยอมรับสิทธิ์หรือ Client ของคำขอ',
      nextAction: 'ตรวจ Allowed Callback URLs, Client ID และสิทธิ์ dsg.approve ของแอปเดิม',
    };
  }
  if (name === 'securityerror' || name === 'notsupportederror' || name === 'invalidstateerror') {
    return {
      code: 'AUTH0_BROWSER_STORAGE_UNAVAILABLE',
      explanation: 'เบราว์เซอร์ไม่อนุญาตฟังก์ชันด้านความปลอดภัยหรือการเก็บธุรกรรม OAuth',
      nextAction: 'เปิดใน Chrome แท็บปกติและกลับจาก Auth0 มายังแท็บเดิม',
    };
  }
  if (name === 'timeouterror' || code === 'timeout' || code === 'network_error') {
    return {
      code: 'AUTH0_CONNECTION_INTERRUPTED',
      explanation: 'การเชื่อมต่อ Auth0 ถูกขัดจังหวะหรือหมดเวลา',
      nextAction: 'ตรวจการเชื่อมต่อเครือข่ายและลองเข้าสู่ระบบอีกครั้ง',
    };
  }
  const fallback: Record<ApprovalAuthPhase, ApprovalAuthProblem> = {
    initialize: {
      code: 'AUTH0_INITIALIZATION_FAILED',
      explanation: 'ไม่สามารถเริ่มต้น SDK Auth0 ได้',
      nextAction: 'เปิดเว็บใน Chrome และตรวจการตั้งค่าแอป Auth0 เดิม หากยังเกิดซ้ำ',
    },
    callback: {
      code: 'AUTH0_CALLBACK_FAILED',
      explanation: 'ไม่สามารถตรวจสอบผลตอบกลับจาก Auth0 ได้',
      nextAction: 'เริ่มเข้าสู่ระบบใหม่ใน Chrome แท็บเดิม ห้ามใช้ Callback เก่าซ้ำ',
    },
    session: {
      code: 'AUTH0_SESSION_CHECK_FAILED',
      explanation: 'ไม่สามารถตรวจสอบสถานะเซสชันของ Auth0 ได้',
      nextAction: 'เปิดเว็บไซต์ใน Chrome และลงชื่อเข้าใช้ใหม่ในแท็บเดิม',
    },
    login: {
      code: 'AUTH0_LOGIN_START_FAILED',
      explanation: 'ไม่สามารถเริ่มการเข้าสู่ระบบ Auth0 ได้',
      nextAction: 'ตรวจเบราว์เซอร์และ Allowed Callback URLs ของ Auth0',
    },
  };
  return fallback[phase];
}
