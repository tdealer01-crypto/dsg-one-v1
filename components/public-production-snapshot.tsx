/**
 * Dated, source-linked, scope-limited AWS production acceptance.
 * Static snapshot deliberately does NOT claim continuous live telemetry.
 * Website session != separate ChatGPT MCP OAuth principal.
 */
const pendingAcceptance = [
  { title: 'Seller listing creation and write', status: 'BLOCKED', nextAction: 'Approve a seller-authenticated write route; capture real listing create/readback and signed evidence.' },
  { title: 'Orders, checkout and payouts', status: 'BLOCKED', nextAction: 'Execute real buyer checkout, settlement and seller payout with provider readback.' },
  { title: 'Marketplace-specific signed Provider v2 receipt', status: 'REVIEW', nextAction: 'Independently verify Marketplace result and Ed25519 signature against the pinned public key.' },
  { title: 'Cinema approved Connect / Execute', status: 'BLOCKED', nextAction: 'Bind signed user approval to plan/principal/payload and verify live Connect/Execute and negative case.' },
  { title: 'Unity / Quest end-to-end', status: 'REVIEW', nextAction: 'Run Unity simulator or Quest with governed request and receipt hash readback.' },
  { title: 'Whole-system Production', status: 'BLOCKED', nextAction: 'Close all remaining seller, approval, Cinema and XR evidence gates before overall acceptance.' },
] as const;

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
      <div className="mt-5" aria-label="Unfinished production acceptance gates">
        <h3 className="text-sm font-bold text-amber-200">Pending capabilities — evidence required</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {pendingAcceptance.map((gate) => (
            <div key={gate.title} className="rounded-xl border border-amber-400/20 bg-slate-950/40 p-3">
              <p className="text-xs font-bold text-slate-200">
                {gate.title} <span className="ml-1 font-mono text-amber-200">{gate.status}</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                <strong>nextAction:</strong> {gate.nextAction}
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-amber-200/90">
        This dated receipt does not mean the current website session is OAuth-bound to Spacetime.
        The existing signed Ed25519 GitHub read-only canary is not a signed Marketplace-specific receipt.
      </p>
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold">
        <a href="https://dsg-3.gitbook.io/dsg-docs/control-plane/dsg-one-control-plane-current-aws-state/dsg-marketplace-verified-oauth-read-e2e-12-october-2026" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline-offset-4 hover:underline">Public sanitized acceptance ↗</a>
        <a href="https://github.com/tdealer01-crypto/DSG-Private-Production-Runtime/actions/runs/38221386222" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline-offset-4 hover:underline">Owner audit — GitHub access required ↗</a>
      </div>
    </section>
  );
}
