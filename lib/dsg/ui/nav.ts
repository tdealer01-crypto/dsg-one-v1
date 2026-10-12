// Single source of truth for the /dsg navigation. Pure data (no React) so a test can check
// every link against a real route (tests/dsg/ui-nav.test.ts).
export type DsgNavIcon =
  | 'home'
  | 'workroom'
  | 'approvals'
  | 'verify'
  | 'sparkles'
  | 'layoutTemplate'
  | 'gitBranch'
  | 'layoutGrid'
  | 'history'
  | 'key'
  | 'barChart2'
  | 'shield'
  | 'cpu'
  | 'bell';

export type DsgNavItem = { label: string; href: string; icon: DsgNavIcon };
export type DsgNavSection = { label: string; items: DsgNavItem[] };

const ACCESS: DsgNavItem = { label: 'เริ่มต้น / Workspace', href: '/dsg/access', icon: 'home' };
const WORKROOM: DsgNavItem = { label: 'Workroom', href: '/dsg/workroom', icon: 'workroom' };
const APPROVALS: DsgNavItem = { label: 'อนุมัติ', href: '/dsg/approvals', icon: 'approvals' };
const VERIFY: DsgNavItem = { label: 'ตรวจสอบ', href: '/dsg/verify', icon: 'verify' };
const APP_BUILDER: DsgNavItem = { label: 'App Builder', href: '/dsg/app-builder', icon: 'sparkles' };

export const DSG_NAV_SECTIONS: DsgNavSection[] = [
  { label: 'ใช้งานหลัก', items: [ACCESS, WORKROOM, APPROVALS, VERIFY] },
  {
    label: 'สร้างแอป',
    items: [
      APP_BUILDER,
      { label: 'Templates', href: '/dsg/templates', icon: 'layoutTemplate' },
      { label: 'Flow Studio', href: '/dsg/flow-studio', icon: 'gitBranch' },
    ],
  },
  {
    label: 'จัดการ',
    items: [
      { label: 'My Apps', href: '/dsg/action-layer', icon: 'layoutGrid' },
      { label: 'ประวัติการสร้าง', href: '/dsg/history', icon: 'history' },
      { label: 'API Keys', href: '/dsg/api-keys', icon: 'key' },
    ],
  },
  {
    label: 'ภาพรวม',
    items: [
      { label: 'Analytics', href: '/dsg/analytics', icon: 'barChart2' },
      { label: 'Governance', href: '/dsg/governance', icon: 'shield' },
      { label: 'Autonomous Level', href: '/dsg/autonomous-level', icon: 'cpu' },
    ],
  },
];

export const DSG_BOTTOM_ITEMS: DsgNavItem[] = [
  { label: 'การแจ้งเตือน', href: '/dsg/notifications', icon: 'bell' },
];

// Thumb-reach shortcuts on phones. The layout adds a fifth "เมนู" button that opens everything.
export const DSG_MOBILE_TABS: DsgNavItem[] = [WORKROOM, APPROVALS, VERIFY, APP_BUILDER];

export function allDsgNavItems(): DsgNavItem[] {
  return [...DSG_NAV_SECTIONS.flatMap((section) => section.items), ...DSG_BOTTOM_ITEMS];
}

export function isNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
