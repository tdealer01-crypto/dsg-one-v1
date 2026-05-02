import { evaluateDsgClaimGate } from '@/lib/dsg/runtime/claim-gate';

const claim = evaluateDsgClaimGate({
  hasEvidence: true,
  hasAuditExport: false,
  hasReplayProof: false,
  hasAuthRbacProof: false,
  hasDeploymentProof: false,
  hasProductionFlowProof: false,
  usesMockState: false,
  isDevOrSmokeOnly: true,
});

export default function AgiDsgPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border p-8">
          <p className="text-sm uppercase tracking-widest opacity-70">AGI DSG Control Plane</p>
          <h1 className="mt-4 text-4xl font-semibold">Deterministic runtime governance</h1>
          <p className="mt-4 text-lg opacity-80">
            Current page is a truthful control surface. It shows the claim gate state and does not report production readiness.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-5">
            <p className="text-sm opacity-70">Claim level</p>
            <p className="mt-2 text-3xl font-semibold">{claim.level}</p>
          </div>
          <div className="rounded-2xl border p-5">
            <p className="text-sm opacity-70">Production claim</p>
            <p className="mt-2 text-3xl font-semibold">Blocked</p>
          </div>
          <div className="rounded-2xl border p-5">
            <p className="text-sm opacity-70">DB source</p>
            <p className="mt-2 text-3xl font-semibold">Pending</p>
          </div>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-2xl font-semibold">Active blocks</h2>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {claim.blocks.map((block) => (
              <li key={block} className="rounded-xl border px-4 py-3 font-mono text-sm">
                {block}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
