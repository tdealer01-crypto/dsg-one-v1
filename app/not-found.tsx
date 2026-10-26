import Link from 'next/link';

export default function NotFound() {
  return <main className="dsg-page"><section className="dsg-state-panel">
    <p className="dsg-eyebrow">404</p><h1 className="dsg-page-title">ไม่พบหน้านี้</h1>
    <p>ลิงก์อาจเปลี่ยนไป เลือกงานหรือเครื่องมือจากเมนูเพื่อทำต่อได้</p>
    <div className="dsg-action-row"><Link href="/dsg/workroom" className="dsg-button-primary">เปิดพื้นที่ทำงาน</Link>
      <Link href="/" className="dsg-button-secondary">หน้าหลัก</Link></div>
  </section></main>;
}
