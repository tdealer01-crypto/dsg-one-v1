'use client';

import { useEffect, useSyncExternalStore } from 'react';

type Lang = 'th' | 'en';
type CopyPair = readonly [string, string];

const pairs: readonly CopyPair[] = [
  ['Customer evidence monitor', 'ตัวตรวจหลักฐานลูกค้า'],
  ['Goal', 'เป้าหมาย'],
  ['Success criteria', 'เงื่อนไขความสำเร็จ'],
  ['Constraints', 'ข้อจำกัด'],
  ['PR Evidence', 'หลักฐานคำขอรวมโค้ด'],
  ['PRD summary', 'สรุปเอกสารงาน'],
  ['Plan steps', 'ขั้นตอนแผน'],
  ['Open generated app in this browser', 'เปิดแอปที่สร้างในเบราว์เซอร์นี้'],
  ['Agent services', 'บริการเอเจนต์'],
  ['Evidence', 'หลักฐาน'],
  ['Governance', 'กำกับดูแล'],
  ['Handoff', 'ส่งมอบงาน'],
  ['Build app', 'สร้างแอป'],
  ['Repository', 'คลังโค้ด'],
  ['Branch', 'สาขาโค้ด'],
  ['Files', 'ไฟล์'],
  ['Audit written', 'บันทึกตรวจสอบแล้ว'],
  ['Copy proof JSON', 'คัดลอก proof JSON'],
  ['Open pull request', 'เปิดคำขอรวมโค้ด'],
  ['Create pull request', 'สร้างคำขอรวมโค้ด'],
  ['Send to runtime', 'ส่งเข้าระบบรัน'],
  ['Approve plan', 'อนุมัติแผน'],
];

const enToTh: ReadonlyMap<string, string> = new Map<string, string>(pairs);
const thToEn: ReadonlyMap<string, string> = new Map<string, string>(pairs.map(([en, th]) => [th, en]));

const LANGUAGE_CHANGED = 'dsg-language-changed';
let sessionLanguage: Lang | null = null;

function currentLang(): Lang {
  if (sessionLanguage) return sessionLanguage;
  try { return window.localStorage.getItem('dsg:language') === 'en' ? 'en' : 'th'; }
  catch { return 'th'; }
}

function subscribe(onChange: () => void) {
  const onStorage = () => { sessionLanguage = null; onChange(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(LANGUAGE_CHANGED, onChange);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(LANGUAGE_CHANGED, onChange); };
}

export function useDsgLanguage(): Lang {
  return useSyncExternalStore(subscribe, currentLang, () => 'th');
}

export function translateDsgCopy(value: string, lang: Lang): string {
  const trimmed = value.trim();
  const next = lang === 'th' ? enToTh.get(trimmed) : thToEn.get(trimmed);
  return next ? value.replace(trimmed, next) : value;
}

/** Opt-in owned UI copy. Never rewrite user content, code, IDs or a React DOM tree. */
export function DsgCopy({ value }: { value: string }) {
  const lang = useDsgLanguage();
  return <>{translateDsgCopy(value, lang)}</>;
}

export function AppLanguageCopyBridge() {
  const lang = useDsgLanguage();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest('button');
      const label = button?.textContent?.trim();
      if (label !== 'ไทย' && label !== 'EN') return;
      sessionLanguage = label === 'EN' ? 'en' : 'th';
      try { window.localStorage.setItem('dsg:language', sessionLanguage); } catch { /* Keep the session choice when storage is unavailable. */ }
      window.dispatchEvent(new Event(LANGUAGE_CHANGED));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
