'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileText,
  GitBranch,
  Loader2,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code?: string; message?: string } };
type Stage = 'idea' | 'features' | 'style' | 'confirm' | 'planned' | 'approved' | 'runtime' | 'done';
type Msg = { id: string; role: 'agent' | 'user'; text: string };

type BuilderJob = {
  id: string;
  status: string;
  claimStatus: string;
  goal?: { goalHash: string; normalizedGoal: string };
  prd?: { title?: string; summary: string };
  proposedPlan?: { steps: Array<{ id: string; title: string; phase: string; riskLevel: string; expectedEvidence: string[] }> };
  gateResult?: { status: string; riskLevel: string; approvalRequired?: boolean };
  planHash?: string;
  approvalHash?: string;
};

type Handoff = { runtimeStatus: string; planHash: string; approvalHash: string };
type ToolCall = {
  status: string;
  claimStatus: string;
  output: {
    pullRequestUrl: string;
    pullRequestNumber: number;
    repository: string;
    branchName: string;
    generatedFiles: Array<{ path: string; evidenceKind: string }>;
  };
  evidence: { auditWritten: boolean; note: string };
  notification?: { title: string; message: string; nextAction: string };
};

const TOOL_NAME = 'dsg.app_builder.launch_agent_runtime';
const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_ACTOR_ID = 'customer';

const stylesBase = ['มือถือก่อน', 'อ่านง่าย', 'เรียบหรู', 'ทอง / แดง / เงิน'];
const constraints = [
  'ใช้เฉพาะ endpoint และข้อมูลจริงของระบบ',
  'ห้ามใช้ mock data เป็นหลักฐาน',
  'ห้ามเคลม production verified ถ้ายังไม่มี proof ครบ',
  'ประหยัด Vercel quota: flow นี้สร้าง GitHub PR ก่อน ยังไม่ trigger production deploy',
  'ต้องออกแบบ mobile-first และอ่านง่าย',
];

const claimCopy: Record<string, { label: string; tone: 'muted' | 'gold' | 'red' | 'silver'; next: string }> = {
  NOT_STARTED: { label: 'ยังไม่เริ่ม', tone: 'silver', next: 'เริ่มจากไอเดียแอปของคุณ' },
  PLANNED_ONLY: { label: 'มีแผนแล้ว', tone: 'silver', next: 'ตรวจแผนและกดอนุมัติ' },
  APPROVED_ONLY: { label: 'อนุมัติแล้ว', tone: 'gold', next: 'ส่งเข้า runtime เพื่อสร้าง branch/PR' },
  ENVIRONMENT_READY: { label: 'runtime พร้อม', tone: 'gold', next: 'เริ่มสร้างแอปเป็น PR' },
  IMPLEMENTED_UNVERIFIED: { label: 'สร้างโค้ดแล้ว รอตรวจ', tone: 'gold', next: 'รัน CI, apply migration, ตรวจ preview เฉพาะเมื่อจำเป็น เพื่อประหยัด Vercel quota' },
  PREVIEW_READY: { label: 'preview พร้อมตรวจ', tone: 'gold', next: 'ตรวจ flow จริงก่อนยกระดับ claim' },
  DEPLOYABLE: { label: 'พร้อม deploy', tone: 'gold', next: 'ใช้ production deploy เฉพาะรอบ proof สุดท้าย' },
  PRODUCTION_BLOCKED: { label: 'ยังขาดหลักฐาน production', tone: 'red', next: 'แนบ live runtime proof, PR evidence, audit row และ production-flow proof' },
  PRODUCTION_VERIFIED: { label: 'production verified', tone: 'gold', next: 'เก็บ proof artifact และ monitoring ต่อเนื่อง' },
};

function optionsFor(idea: string) {
  const value = idea.toLowerCase();
  if (/todo|task|งาน/.test(value)) return ['เพิ่มงาน', 'แก้งาน', 'ลบงาน', 'ติ๊กว่าเสร็จแล้ว', 'ค้นหางาน', 'กรองงานค้าง'];
  if (/บัญชี|รายรับ|รายจ่าย|expense|income/.test(value)) return ['เพิ่มรายการ', 'แก้รายการ', 'ลบรายการ', 'แยกรายรับ/รายจ่าย', 'แสดงยอดรวม', 'กรองตามเดือน'];
  if (/จอง|queue|booking|คิว/.test(value)) return ['สร้างคิว', 'แก้ไขคิว', 'ยกเลิกคิว', 'ดูตารางเวลา', 'สถานะการจอง', 'แจ้งเตือน'];
  if (/ร้าน|shop|store|สินค้า|ขาย/.test(value)) return ['เพิ่มสินค้า', 'แก้ไขสินค้า', 'ดูออเดอร์', 'ค้นหาสินค้า', 'สถานะคำสั่งซื้อ', 'รายงานยอดขาย'];
  return ['เพิ่มข้อมูล', 'แก้ข้อมูล', 'ลบข้อมูล', 'ดูรายการ', 'ค้นหา', 'แสดงสถานะ'];
}

function readResult<T>(json: ApiResult<T>): T {
  if (!json.ok) throw new Error(json.error?.message || json.error?.code || 'REQUEST_FAILED');
  return json.data;
}

function toneClass(tone: 'muted' | 'gold' | 'red' | 'silver') {
  if (tone === 'gold') return 'border-[#d6a63a]/35 bg-[#d6a63a]/10 text-[#f5d27a]';
  if (tone === 'red') return 'border-[#b4232b]/35 bg-[#b4232b]/10 text-[#ffb4b8]';
  if (tone === 'silver') return 'border-[#c8c8c8]/20 bg-[#c8c8c8]/10 text-[#d9d9d9]';
  return 'border-[#c8c8c8]/15 bg-[#111113] text-[#c8c8c8]';
}

function StatusPill({ status }: { status?: string }) {
  const item = claimCopy[status || 'NOT_STARTED'] ?? { label: status || 'pending', tone: 'silver' as const, next: 'ตรวจรายละเอียดต่อ' };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black', toneClass(item.tone))}>
      {item.tone === 'red' ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {item.label}
    </span>
  );
}

function StepCard({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className={cn('min-w-[140px] rounded-xl border px-3 py-2', ok ? toneClass('gold') : toneClass('muted'))}>
      <div className="flex items-center justify-between gap-2 text-xs font-black">
        <span>{label}</span>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5 opacity-60" />}
      </div>
      <p className="mt-1 truncate text-[11px] opacity-80">{detail}</p>
    </div>
  );
}

function Pick({ active, text, onClick }: { active: boolean; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('rounded-xl border px-3 py-2 text-xs font-bold transition-colors', active ? toneClass('gold') : toneClass('muted'))}>
      {active ? '✓ ' : '+ '}{text}
    </button>
  );
}

export function GuidedAppBuilderView() {
  const [stage, setStage] = useState<Stage>('idea');
  const [input, setInput] = useState('');
  const [idea, setIdea] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>(stylesBase);
  const [notes, setNotes] = useState<string[]>([]);
  const [messages, setMessages] = useState<Msg[]>([{ id: 'm0', role: 'agent', text: 'อยากสร้างแอปอะไรครับ? พิมพ์สั้น ๆ เช่น Todo, รายรับรายจ่าย, จองคิว หรือร้านค้า แล้วผมจะช่วยจัดฟีเจอร์ให้' }]);
  const [job, setJob] = useState<BuilderJob | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [toolCall, setToolCall] = useState<ToolCall | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const featureOptions = useMemo(() => optionsFor(idea), [idea]);
  const goal = useMemo(() => `สร้าง${idea || 'แอปใหม่'} โดยให้ผู้ใช้ทำงานหลักได้: ${(features.length ? features : ['ฟีเจอร์ที่ผู้ใช้เลือก']).join(', ')}. รูปแบบหน้าจอ: ${styles.join(', ')}. ต้องแสดงเฉพาะข้อมูลจริง มีหลักฐานการทำงาน และไม่ใช้ข้อมูลจำลอง.${notes.length ? ` หมายเหตุ: ${notes.join(' | ')}` : ''}`, [features, idea, notes, styles]);
  const criteria = useMemo(() => [...(features.length ? features.map((feature) => `ผู้ใช้${feature}ได้`) : ['ผู้ใช้ทำงานหลักของแอปได้']), 'หน้าจออ่านง่ายบนมือถือ', 'มีผลลัพธ์หรือหลักฐานที่ตรวจสอบได้'], [features]);
  const claim = claimCopy[job?.claimStatus || 'NOT_STARTED'] ?? claimCopy.NOT_STARTED;

  async function api<T>(path: string, init?: RequestInit) {
    const res = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-dsg-workspace-id': DEFAULT_WORKSPACE_ID,
        'x-dsg-actor-id': DEFAULT_ACTOR_ID,
        ...(init?.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({ ok: false, error: { message: 'INVALID_JSON_RESPONSE' } })) as ApiResult<T>;
    if (!res.ok && json.ok) throw new Error(`HTTP_${res.status}`);
    return readResult(json);
  }

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : 'REQUEST_FAILED'); } finally { setBusy(null); }
  }

  function say(role: Msg['role'], text: string) {
    setMessages((current) => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text }]);
  }

  function toggle(value: string, list: string[], setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    say('user', text);
    if (stage === 'idea') {
      const picked = optionsFor(text).slice(0, 4);
      setIdea(text);
      setFeatures(picked);
      setStage('features');
      say('agent', `รับทราบ: ${text}. ผมเลือกฟีเจอร์เริ่มต้นให้แล้ว คุณเพิ่ม/ลบได้ก่อนยืนยัน`);
      return;
    }
    setNotes((current) => [...current, text]);
    say('agent', 'เพิ่มหมายเหตุให้แล้วครับ ตรวจด้านขวาแล้วค่อยกดยืนยันเรียก API');
  }

  const buildPlan = () => run('plan', async () => {
    const created = await api<BuilderJob>('/api/dsg/app-builder/jobs', {
      method: 'POST',
      body: JSON.stringify({
        goal,
        successCriteria: criteria,
        constraints,
        targetStack: { frontend: 'nextjs', backend: 'next-api', database: 'supabase-postgres', auth: 'none', deploy: 'vercel' },
      }),
    });
    const planned = await api<BuilderJob>(`/api/dsg/app-builder/jobs/${created.id}/plan`, { method: 'POST' });
    setJob(planned);
    setStage('planned');
    say('agent', 'สร้าง PRD และแผนผ่าน API จริงแล้วครับ ตรวจแผน แล้วกดอนุมัติถ้าพร้อม');
  });

  const approve = () => run('approval', async () => {
    if (!job?.proposedPlan) throw new Error('APP_BUILDER_PLAN_REQUIRED');
    const approved = await api<BuilderJob>(`/api/dsg/app-builder/jobs/${job.id}/approval`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE', reason: 'Customer approved visible guided plan before runtime action.' }),
    });
    setJob(approved);
    setStage('approved');
    say('agent', 'อนุมัติแผนแล้วครับ ขั้นต่อไปคือส่งเข้า runtime');
  });

  const sendRuntime = () => run('handoff', async () => {
    if (!job?.approvalHash) throw new Error('APP_BUILDER_APPROVAL_REQUIRED');
    const data = await api<Handoff>(`/api/dsg/app-builder/jobs/${job.id}/runtime-handoff`, { method: 'POST' });
    setHandoff(data);
    setStage('runtime');
    say('agent', 'runtime handoff พร้อมแล้วครับ ขั้นถัดไปจะสร้าง branch/PR ไม่ใช่ deploy production');
  });

  const launch = () => run('tool-call', async () => {
    if (!job?.approvalHash) throw new Error('APP_BUILDER_APPROVAL_REQUIRED');
    const data = await api<{ job: BuilderJob; toolCall: ToolCall }>(`/api/dsg/app-builder/jobs/${job.id}/tool-call`, {
      method: 'POST',
      body: JSON.stringify({ toolName: TOOL_NAME, arguments: { mode: 'agent_runtime_fullstack_pr' } }),
    });
    setJob(data.job);
    setToolCall(data.toolCall);
    setStage('done');
    say('agent', 'สร้างโค้ดเป็น GitHub PR แล้วครับ ยังไม่ใช้ Vercel quota จนกว่าจะต้องตรวจ preview/production proof');
  });

  async function copyProof() {
    const proof = {
      jobId: job?.id,
      status: job?.status,
      claimStatus: job?.claimStatus,
      planHash: handoff?.planHash || job?.planHash,
      approvalHash: handoff?.approvalHash || job?.approvalHash,
      pullRequestUrl: toolCall?.output.pullRequestUrl,
      branchName: toolCall?.output.branchName,
      repository: toolCall?.output.repository,
      generatedFiles: toolCall?.output.generatedFiles,
      auditWritten: toolCall?.evidence.auditWritten,
      vercelQuotaPolicy: 'No production deploy from this UI flow. Use Vercel only for preview/proof when necessary.',
    };
    await navigator.clipboard.writeText(JSON.stringify(proof, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const steps = [
    { label: 'ไอเดีย', ok: Boolean(idea), detail: idea || 'รอเริ่ม' },
    { label: 'แผน', ok: Boolean(job?.proposedPlan), detail: job?.gateResult ? `${job.gateResult.status}/${job.gateResult.riskLevel}` : 'รอสร้าง' },
    { label: 'อนุมัติ', ok: Boolean(job?.approvalHash), detail: job?.approvalHash ? `${job.approvalHash.slice(0, 8)}…` : 'รอ' },
    { label: 'runtime', ok: Boolean(handoff), detail: handoff?.runtimeStatus ?? 'รอส่ง' },
    { label: 'PR', ok: Boolean(toolCall), detail: toolCall?.status ?? 'ยังไม่สร้าง' },
  ];

  return (
    <div className="space-y-3 text-[#c8c8c8]">
      <div className="flex gap-2 overflow-x-auto pb-1">{steps.map((step) => <StepCard key={step.label} {...step} />)}</div>
      {error ? <div className="rounded-xl border border-[#b4232b]/35 bg-[#b4232b]/10 p-3 text-sm text-[#ffb4b8]">{error}</div> : null}

      <div className="grid min-h-[620px] gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col rounded-xl border border-[#c8c8c8]/15 bg-[#0c0c0d]">
          <div className="border-b border-[#c8c8c8]/15 px-4 py-3">
            <div className="flex items-center gap-2 text-[#f2f2f2]"><Sparkles className="h-4 w-4 text-[#d6a63a]" /><p className="text-sm font-black">สร้างแอปกับ DSG Agent</p></div>
            <p className="mt-1 text-xs text-[#8d8d8d]">ลูกค้าคุยง่าย ระบบสร้างแผนก่อน และทุก action สำคัญต้องกดยืนยัน</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((message) => (
              <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[86%] rounded-2xl border px-3 py-2 text-sm leading-6', message.role === 'user' ? toneClass('gold') : toneClass('muted'))}>
                  <div className="mb-1 text-[10px] font-black uppercase opacity-70">{message.role === 'agent' ? 'DSG Agent' : 'คุณ'}</div>
                  {message.text}
                </div>
              </div>
            ))}

            {stage === 'features' ? (
              <div className="rounded-2xl border border-[#c8c8c8]/15 bg-[#111113] p-3">
                <p className="text-xs font-black text-[#f2f2f2]">เลือกฟีเจอร์ที่ลูกค้าจะได้ใช้จริง</p>
                <div className="mt-2 flex flex-wrap gap-2">{featureOptions.map((feature) => <Pick key={feature} active={features.includes(feature)} text={feature} onClick={() => toggle(feature, features, setFeatures)} />)}</div>
                <button onClick={() => { setStage('style'); say('agent', 'ต่อไปเลือกสไตล์หน้าจอครับ'); }} className={cn('mt-3 rounded-xl border px-3 py-2 text-xs font-black', toneClass('gold'))}>ต่อไป: เลือกสไตล์</button>
              </div>
            ) : null}

            {stage === 'style' ? (
              <div className="rounded-2xl border border-[#c8c8c8]/15 bg-[#111113] p-3">
                <p className="text-xs font-black text-[#f2f2f2]">สไตล์หน้าจอ</p>
                <div className="mt-2 flex flex-wrap gap-2">{['มือถือก่อน', 'อ่านง่าย', 'เรียบหรู', 'ทอง / แดง / เงิน', 'จอมอนิเตอร์สด'].map((style) => <Pick key={style} active={styles.includes(style)} text={style} onClick={() => toggle(style, styles, setStyles)} />)}</div>
                <button onClick={() => { setStage('confirm'); say('agent', 'ผมสรุปคำสั่งงานให้แล้ว ตรวจด้านขวา ถ้าโอเคกดยืนยันเรียก API'); }} className={cn('mt-3 rounded-xl border px-3 py-2 text-xs font-black', toneClass('gold'))}>สรุปให้ตรวจ</button>
              </div>
            ) : null}

            {stage === 'confirm' ? (
              <div className="rounded-2xl border border-[#d6a63a]/30 bg-[#d6a63a]/5 p-3">
                <p className="text-sm font-black text-[#f5d27a]">ตรวจแล้วค่อยเรียก API</p>
                <p className="mt-2 text-xs leading-5 text-[#d9d9d9]">ขั้นนี้สร้าง job และ plan เท่านั้น ยังไม่ deploy และไม่ใช้ Vercel quota</p>
                <button onClick={buildPlan} disabled={!!busy} className={cn('mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50', toneClass('gold'))}>{busy === 'plan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ยืนยันและสร้างแผน</button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#c8c8c8]/15 p-3">
            <div className="flex gap-2">
              <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') send(); }} placeholder={stage === 'idea' ? 'พิมพ์สั้น ๆ เช่น เว็บจองคิวร้านกาแฟ' : 'พิมพ์สิ่งที่อยากเพิ่มหรือแก้...'} className="h-11 min-w-0 flex-1 rounded-xl border border-[#c8c8c8]/15 bg-[#111113] px-3 text-sm text-[#f2f2f2] outline-none placeholder:text-[#666] focus:border-[#d6a63a]/50" />
              <button onClick={send} disabled={!input.trim()} className={cn('inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-xs font-black disabled:opacity-50', toneClass('gold'))}><Send className="h-4 w-4" /> ส่ง</button>
            </div>
          </div>
        </section>

        <aside className="space-y-3 rounded-xl border border-[#c8c8c8]/15 bg-[#111113] p-3">
          <section className="rounded-xl border border-[#d6a63a]/25 bg-[#d6a63a]/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#d6a63a]">Customer evidence monitor</p>
                <p className="mt-1 text-xs leading-5 text-[#c8c8c8]">สร้าง PR ก่อน ประหยัด Vercel quota และไม่แสดงหลักฐานปลอม</p>
              </div>
              <StatusPill status={job?.claimStatus} />
            </div>
            <div className="mt-3 rounded-lg border border-[#c8c8c8]/10 bg-[#0c0c0d] p-3 text-xs leading-5 text-[#d9d9d9]">
              <p className="font-black text-[#f2f2f2]">ขั้นต่อไป</p>
              <p>{claim.next}</p>
            </div>
          </section>

          <section className="rounded-xl border border-[#c8c8c8]/15 bg-[#0c0c0d] p-3">
            <p className="text-xs font-black text-[#f2f2f2]">Goal</p>
            <p className="mt-2 text-xs leading-5 text-[#d9d9d9]">{goal}</p>
          </section>

          <section className="grid gap-2 text-xs">
            <div className="rounded-lg border border-[#c8c8c8]/10 bg-[#0c0c0d] p-3">
              <p className="font-black text-[#8d8d8d]">Success criteria</p>
              <ul className="mt-1 space-y-1 leading-5 text-[#d9d9d9]">{criteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}</ul>
            </div>
            <div className="rounded-lg border border-[#c8c8c8]/10 bg-[#0c0c0d] p-3">
              <p className="font-black text-[#8d8d8d]">Constraints</p>
              <ul className="mt-1 space-y-1 leading-5 text-[#d9d9d9]">{constraints.map((constraint) => <li key={constraint}>• {constraint}</li>)}</ul>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button onClick={approve} disabled={!!busy || !job?.proposedPlan} className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-40', toneClass('gold'))}><ShieldCheck className="h-4 w-4" /> อนุมัติแผน</button>
            <button onClick={sendRuntime} disabled={!!busy || !job?.approvalHash} className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-40', toneClass('silver'))}><GitBranch className="h-4 w-4" /> ส่งเข้า runtime</button>
            <button onClick={launch} disabled={!!busy || !job?.approvalHash || job.status !== 'READY_FOR_RUNTIME'} className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-40', toneClass('gold'))}>{busy === 'tool-call' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} สร้าง PR</button>
          </div>

          {job?.prd?.summary ? <section className="rounded-xl border border-[#c8c8c8]/15 bg-[#0c0c0d] p-3"><p className="text-xs font-black text-[#f2f2f2]">PRD summary</p><p className="mt-2 text-xs leading-5 text-[#d9d9d9]">{job.prd.summary}</p></section> : null}

          {job?.proposedPlan ? <section className="space-y-2 rounded-xl border border-[#c8c8c8]/15 bg-[#0c0c0d] p-3"><p className="text-xs font-black text-[#f2f2f2]">Plan steps</p>{job.proposedPlan.steps.map((step) => <div key={step.id} className="rounded-lg border border-[#c8c8c8]/10 p-2"><p className="text-[11px] text-[#8d8d8d]">{step.id} · {step.phase} · {step.riskLevel}</p><p className="mt-1 text-xs font-bold text-[#d9d9d9]">{step.title}</p></div>)}</section> : null}

          {toolCall?.output ? (
            <section className="space-y-3 rounded-xl border border-[#d6a63a]/25 bg-[#d6a63a]/5 p-3 text-xs leading-5 text-[#f5d27a]">
              <div className="flex items-center gap-2 font-black"><FileText className="h-4 w-4" /> PR Evidence</div>
              <p>Repo: {toolCall.output.repository}</p>
              <p>Branch: {toolCall.output.branchName}</p>
              <p>Files: {toolCall.output.generatedFiles.length}</p>
              <p>Audit written: {String(toolCall.evidence.auditWritten)}</p>
              <div className="flex flex-wrap gap-2">
                <a href={toolCall.output.pullRequestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#d6a63a]/35 px-2 py-1 underline">เปิด PR #{toolCall.output.pullRequestNumber}<ExternalLink className="h-3.5 w-3.5" /></a>
                <button onClick={() => void copyProof()} className="inline-flex items-center gap-1 rounded-lg border border-[#d6a63a]/35 px-2 py-1"><Clipboard className="h-3.5 w-3.5" /> {copied ? 'คัดลอกแล้ว' : 'Copy proof JSON'}</button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
