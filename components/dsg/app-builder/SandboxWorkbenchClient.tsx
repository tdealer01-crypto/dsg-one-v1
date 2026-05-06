'use client';

import { useState } from 'react';

type SandboxPlan = {
  ok?: boolean;
  error?: { code: string; message: string };
  jobId?: string;
  goal?: string;
  branchName?: string;
  inputHash?: string;
  claimStatus?: string;
  planHash?: string;
  fileWrites?: Array<{ path: string; mode: string; gate: string }>;
  commands?: Array<{ command: string; gate: string; execution: string }>;
  gates?: Record<string, unknown>;
  nextActions?: string[];
  productionReadyClaim?: false;
};

const dsgHeaders = {
  'content-type': 'application/json',
  'x-dsg-workspace-id': 'demo-workspace',
  'x-dsg-actor-id': 'operator-ui',
  'x-dsg-actor-role': 'operator',
  'x-dsg-permissions': 'memory:read,memory:write',
};

const examples = [
  'สร้างเกม ABC เด็ก 3 ขวบ มีปุ่มใหญ่ พรีวิวข้างๆ และบันทึกคะแนนลงฐานข้อมูล',
  'สร้างระบบจองคิวร้านเล็ก ลูกค้าเลือกเวลา เจ้าของร้านเห็นรายการจอง',
  'สร้าง CRM ทีมเล็ก มีรายชื่อลูกค้า โน้ต งานติดตาม และสถานะดีล',
];

function tone(ok?: boolean) {
  if (ok === true) return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
  if (ok === false) return 'border-rose-400/40 bg-rose-500/10 text-rose-100';
  return 'border-amber-400/40 bg-amber-500/10 text-amber-100';
}

export function SandboxWorkbenchClient() {
  const [goal, setGoal] = useState(examples[0]);
  const [jobId, setJobId] = useState('ui-sandbox-demo');
  const [commands, setCommands] = useState('npm run dsg:typecheck\nnpm run build:termux');
  const [plan, setPlan] = useState<SandboxPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready. Create a sandbox plan before any file write or PR action.');

  async function runSandboxPlan() {
    setBusy(true);
    setStatus('Evaluating sandbox path, command, secret, truth, and user-benefit gates…');
    try {
      const response = await fetch('/api/dsg/app-builder/sandbox/plan', {
        method: 'POST',
        headers: dsgHeaders,
        body: JSON.stringify({
          jobId,
          goal,
          commands: commands.split('\n').map((line) => line.trim()).filter(Boolean),
        }),
      });
      const json = (await response.json()) as SandboxPlan;
      if (!response.ok || json.error) throw new Error(json.error?.message || 'SANDBOX_PLAN_FAILED');
      setPlan(json);
      setStatus(`${json.claimStatus || 'SANDBOX_PLAN_READY'} · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'SANDBOX_PLAN_FAILED');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Sandbox Workbench</p>
        <h2 className="mt-2 text-3xl font-black text-white">ตรวจแผนเขียนไฟล์ก่อนให้ agent ทำงาน</h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          ขั้นนี้คือเบรกสำคัญก่อนต่อ OpenHands-style runner หรือ PR executor: ผู้ใช้ต้องเห็น branch, file paths, commands, gate result และ next action ก่อนทุกครั้ง.
        </p>

        <div className="mt-5 grid gap-3">
          {examples.map((example) => (
            <button key={example} onClick={() => setGoal(example)} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left text-sm text-slate-300 hover:border-indigo-400/50">
              {example}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Job ID</label>
        <input value={jobId} onChange={(event) => setJobId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />

        <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Goal</label>
        <textarea value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-2 min-h-32 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-indigo-500" />

        <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Allowed commands requested</label>
        <textarea value={commands} onChange={(event) => setCommands(event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-white outline-none focus:border-indigo-500" />

        <button onClick={() => void runSandboxPlan()} disabled={busy} className="mt-5 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Checking gates…' : 'Create sandbox plan'}
        </button>

        <p className={`mt-4 rounded-2xl border p-3 text-xs font-mono ${tone(plan?.ok)}`}>{status}</p>
      </section>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-200">Sandbox result</p>
          <h2 className="mt-1 text-2xl font-black text-white">แผน branch / files / commands</h2>
          {plan ? (
            <div className="mt-5 space-y-4">
              <div className={`rounded-2xl border p-4 ${tone(plan.ok)}`}>
                <p className="text-xs font-bold uppercase tracking-[0.2em]">{plan.claimStatus}</p>
                <p className="mt-2 break-all text-xs">planHash: {plan.planHash}</p>
                <p className="mt-1 break-all text-xs">branch: {plan.branchName}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">File writes</p>
                <div className="mt-3 space-y-2">
                  {(plan.fileWrites || []).map((file) => (
                    <div key={file.path} className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
                      <p className="break-all font-mono">{file.path}</p>
                      <p className="mt-1 text-slate-500">{file.mode} · {file.gate}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Commands</p>
                <div className="mt-3 space-y-2">
                  {(plan.commands || []).map((command) => (
                    <div key={command.command} className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
                      <p className="font-mono">{command.command}</p>
                      <p className="mt-1 text-slate-500">{command.gate} · {command.execution}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Next actions</p>
                <div className="mt-3 space-y-2">
                  {(plan.nextActions || []).map((action) => <p key={action} className="rounded-xl bg-slate-900 p-2 text-xs text-slate-300">{action}</p>)}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              ยังไม่มี sandbox plan. กด Create sandbox plan เพื่อดูหลักฐานก่อนเขียนไฟล์.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
