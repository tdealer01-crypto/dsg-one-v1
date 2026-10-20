/** Only present a specific human-readable action if the exact bound payload matches. */
export type ApprovalPreviewInput = {
  route_id?: string;
  payload?: Record<string, unknown>;
  risk_tier?: string;
};

export function approvalPreview(approval: ApprovalPreviewInput): { title: string; description: string } {
  if (approval.route_id === 'route.cinema-remote.execute') {
    const payload = approval.payload;
    const args = payload?.arguments && typeof payload.arguments === 'object' && !Array.isArray(payload.arguments)
      ? payload.arguments as Record<string, unknown> : {};
    const steps = Array.isArray(args.steps) ? args.steps : [];
    const kinds = steps.map(item => {
      if (!item || typeof item !== 'object') return '';
      const action = (item as Record<string, unknown>).action;
      return action && typeof action === 'object' && typeof (action as Record<string, unknown>).kind === 'string'
        ? (action as Record<string, unknown>).kind as string : '';
    });
    const first = steps[0] as Record<string, unknown> | undefined;
    const action = first && typeof first.action === 'object' ? first.action as Record<string, unknown> : {};
    const params = action.parameters && typeof action.parameters === 'object'
      ? action.parameters as Record<string, unknown> : {};
    if (payload?.action === 'browser.remote.run' &&
      steps.length === 3 &&
      kinds.join('|') === 'browser.navigate|browser.extract|browser.screenshot' &&
      params.url === 'https://dsg.pics/dsg/workroom') {
      return {
        title: 'ตรวจหน้า DSG ONE Workroom',
        description: 'ให้ Cinema เปิดหน้า Workroom อ่านข้อมูลหน้าเว็บ และจับภาพหน้าจอเท่านั้น',
      };
    }
    return {
      title: 'อนุมัติการควบคุมเบราว์เซอร์ด้วย Cinema',
      description: 'มีคำสั่งเบราว์เซอร์ที่ต้องตรวจสอบในรายละเอียดก่อนยืนยัน',
    };
  }
  if (approval.route_id?.startsWith('route.desktop-native.')) {
    return {
      title: 'อนุมัติการทำงานบน DSG Native',
      description: 'ตรวจว่าระบบจะเข้าถึงอุปกรณ์หรือดำเนินการอะไรในรายละเอียดก่อนยืนยัน',
    };
  }
  return {
    title: 'อนุมัติคำสั่ง DSG ONE',
    description: 'ตรวจรายละเอียดของคำสั่งจริงที่ผูกกับ Plan และ Payload ก่อนยืนยัน',
  };
}
