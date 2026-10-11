// Single source of truth for how a new visitor asks for access.
// The address is the support contact already published in marketplace/launch-manifest.json.
export const ACCESS_REQUEST_EMAIL = 't.dealer01@dsg.pics';

const SUBJECT = 'ขอสิทธิ์ใช้งาน DSG ONE';
const BODY = [
  'ชื่อ / องค์กร:',
  'อีเมลที่จะใช้ล็อกอิน:',
  'อยากใช้ทำอะไร (1-2 ประโยค):',
  '',
].join('\n');

export function accessRequestMailto(): string {
  return `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;
}
