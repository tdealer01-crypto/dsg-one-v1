'use client';

import Link from 'next/link';

export default function ApplicationError({ reset }: { reset: () => void }) {
  return <main className="dsg-page">
    <section className="dsg-state-panel" aria-labelledby="page-error-title">
      <p className="dsg-eyebrow">เปิดหน้านี้ไม่ได้</p>
      <h1 id="page-error-title" className="dsg-page-title">ข้อมูลของหน้ายังไม่พร้อม</h1>
      <p role="alert">ลองโหลดส่วนนี้ใหม่ หรือกลับไปดูงานที่บันทึกไว้ การโหลดใหม่ไม่ได้สั่งทำงานซ้ำ</p>
      <div className="dsg-action-row"><button type="button" onClick={reset} className="dsg-button-primary">ลองโหลดใหม่</button>
        <Link href="/dsg/workroom" className="dsg-button-secondary">กลับไปทำงาน</Link></div>
    </section>
  </main>;
}
