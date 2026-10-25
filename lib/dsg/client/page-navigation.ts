export type DsgNavigationItem = { label: string; href: string; sample?: boolean };
export type DsgNavigationGroup = { label: string; items: DsgNavigationItem[]; secondary?: boolean };

/** One navigation vocabulary for every DSG-owned workspace and review page. */
export const DSG_NAVIGATION: DsgNavigationGroup[] = [
  { label: 'ทำงาน', items: [
    { label: 'งานและแชท', href: '/dsg/workroom' },
    { label: 'สร้างแอป', href: '/dsg/app-builder' },
    { label: 'รออนุมัติ', href: '/dsg/approvals' },
    { label: 'ประวัติงานและผลลัพธ์', href: '/dsg/history' },
    { label: 'งานที่ต้องติดตาม', href: '/dsg/notifications' },
  ] },
  { label: 'เครื่องมือ', items: [
    { label: 'ควบคุมเว็บ · Cinema', href: '/dsg/workroom?tool=browser#live-controls' },
    { label: 'อุปกรณ์ · Native', href: '/control/' },
    { label: 'วางแผนงาน · Flow Studio', href: '/dsg/flow-studio' },
    { label: 'เทมเพลต', href: '/dsg/templates' },
    { label: 'เทมเพลตของฉัน', href: '/dsg/templates/my' },
    { label: 'รายได้จากเทมเพลต', href: '/dsg/templates/my-payouts' },
  ] },
  { label: 'พื้นที่ทำงาน', items: [
    { label: 'บัญชีและพื้นที่ทำงาน', href: '/dsg/access' },
    { label: 'การใช้งาน', href: '/dsg/analytics' },
    { label: 'API Keys', href: '/dsg/api-keys' },
  ] },
  { label: 'ตรวจสอบและเครื่องมือเพิ่มเติม', secondary: true, items: [
    { label: 'สถานะความสามารถ', href: '/dsg/autonomous-level' },
    { label: 'ตรวจหลักฐาน', href: '/dsg/verify' },
    { label: 'กฎการทำงาน', href: '/dsg/governance' },
    { label: 'Telemetry · Agent Nexus', href: '/dsg/action-layer' },
    { label: 'ทดสอบแผนสร้างแอป', href: '/dsg/app-builder/sandbox' },
    { label: 'ทักษะ Agent', href: '/agent-skills' },
    { label: 'Adapter และหลักฐาน', href: '/dsg-os' },
    { label: 'Runtime Governance', href: '/agi' },
    { label: 'ตรวจความพร้อมผลิตภัณฑ์', href: '/product-ready' },
    { label: 'แก้ไขและตรวจซ้ำ', href: '/fix-and-verify' },
  ] },
  { label: 'ความเชื่อมั่นและการช่วยเหลือ', secondary: true, items: [
    { label: 'ความพร้อมของบริการ', href: '/enterprise/readiness' },
    { label: 'ความปลอดภัย', href: '/enterprise/security' },
    { label: 'สิทธิ์และการเข้าถึง', href: '/enterprise/security-rbac' },
    { label: 'สิทธิ์การใช้งาน', href: '/enterprise/entitlement' },
    { label: 'การเข้าถึงสำหรับทุกคน', href: '/enterprise/accessibility' },
    { label: 'ภาพรวมตลาด', href: '/enterprise/market' },
    { label: 'ความเป็นส่วนตัว', href: '/enterprise/privacy' },
    { label: 'เงื่อนไขบริการ', href: '/enterprise/terms' },
    { label: 'การช่วยเหลือ', href: '/enterprise/support' },
  ] },
];

const publicPages = new Set(['/', '/login', '/remote-browser-execution']);

export function dsgPageLocation(pathname: string) {
  if (pathname.startsWith('/generated-apps/')) {
    return { surface: 'preview' as const, title: 'พรีวิวแอป', group: 'สร้างแอป' };
  }
  for (const group of DSG_NAVIGATION) {
    const item = group.items.find(candidate => candidate.href === pathname);
    if (item) return { surface: 'workspace' as const, title: item.label, group: group.label };
  }
  if (pathname.startsWith('/dsg/app-builder/')) {
    return { surface: 'workspace' as const, title: 'รายละเอียดงานสร้างแอป', group: 'สร้างแอป' };
  }
  return { surface: publicPages.has(pathname) ? 'public' as const : 'workspace' as const,
    title: 'DSG ONE', group: 'พื้นที่ทำงาน' };
}

export function isDsgNavigationActive(pathname: string, href: string) {
  if (href.includes('?') || href === '/control/') return false;
  if (pathname === href) return true;
  // The deepest listed route owns selection. Avoid two current-page links.
  return pathname.startsWith(href + '/') &&
    !DSG_NAVIGATION.some(group => group.items.some(item =>
      item.href !== href && !item.href.includes('?') &&
      item.href.startsWith(href + '/') &&
      (pathname === item.href || pathname.startsWith(item.href + '/'))));
}
