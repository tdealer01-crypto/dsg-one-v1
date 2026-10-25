export default function ApplicationLoading() {
  return <div className="dsg-page" role="status" aria-live="polite" aria-busy="true">
    <p className="text-sm text-slate-300">กำลังเปิดหน้า…</p>
    <div aria-hidden="true" className="mt-6 space-y-4 motion-safe:animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-800" /><div className="h-32 rounded-xl bg-slate-900" />
    </div>
  </div>;
}
