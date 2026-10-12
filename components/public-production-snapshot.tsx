/**
 * Dated, source-linked, scope-limited AWS production acceptance.
 * Static snapshot deliberately does NOT claim continuous live telemetry.
 * Website session != separate ChatGPT MCP OAuth principal.
 */
export function PublicProductionSnapshot({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="Verified AWS Marketplace production status"
      className="rounded-3xl border border-emerald-400/30 bg-emerald-950/20 p-6 text-slate-200 shadow-lg shadow-black/10 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
          AWS Production · Verified 12 October 2026
        </p>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
          Marketplace public READ E2E · PASS
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
        Governed OAuth Marketplace catalog read is live.
      </h2>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
        Owner-gated AWS atomic activation <strong>#38221386222</strong> passed after PR #663 and exact-main CI.
        The deployed `route.marketplace.listings-read` was executed through a real bound OAuth principal:
        policy <strong>ALLOW</strong>, provider result <code className="text-emerald-100">{"{\"items\":[]}"}</code>.
        Empty listings are a real empty catalog, not fabricated product data.
      </p>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-3">
          <span className="block text-xs text-slate-400">AWS services</span>
          <strong className="mt-1 block text-emerald-200">5/5 healthy at acceptance</strong>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-3">
          <span className="block text-xs text-slate-400">Governed Route / license</span>
          <strong className="mt-1 block text-emerald-200">30 configured / 33 entitled</strong>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-3">
          <span className="block text-xs text-slate-400">Evidence chain</span>
          <strong className="mt-1 block text-emerald-200">Valid · 142 records at acceptance</strong>
        </div>
      </div>
      {!compact && (
        <p className="mt-4 break-all font-mono text-xs text-slate-400">
          Image sha256:fd718ca2ed2ab3de5da40fe987d83f45788636eb0d0edc0251f27b53e8e4f701
        </p>
      )}
      <p className="mt-4 text-xs leading-6 text-amber-200/90">
        Not verified: seller/listing write, orders and payments, Marketplace-specific signed Provider v2 receipt,
        Cinema approved browser connect/execute, Unity/Quest, or whole-system Production.
        This dated receipt does not mean the current website session is OAuth-bound to Spacetime.
      </p>
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold">
        <a href="https://github.com/tdealer01-crypto/DSG-Private-Production-Runtime/actions/runs/38221386222" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline-offset-4 hover:underline">Activation evidence ↗</a>
        <a href="https://github.com/tdealer01-crypto/DSG-Private-Production-Runtime/issues/656#issuecomment-6120341073" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline-offset-4 hover:underline">Governed OAuth & evidence ↗</a>
        <a href="https://dsg-3.gitbook.io/dsg-docs/control-plane/" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline-offset-4 hover:underline">Public documentation ↗</a>
      </div>
    </section>
  );
}
