'use client';

import { useEffect, useRef, useState } from 'react';
import { getDsgBrowserSession, DSG_AUTH0_CALLBACK } from '@/lib/dsg/user-bound/browser-session';
import { classifyAuth0SessionFailure } from '@/lib/dsg/user-bound/oauth-refresh';
import {
  asRecord, catalogRoutes, composeWorkroomRoutes, publicWorkroomReceipt,
  uniqueWorkroomRoute, workroomReceiptMatches,
  type JsonRecord, type WorkroomExecution, type WorkroomRoute,
} from '@/lib/dsg/user-bound/workroom-contract';

type ToolReply = { ok?: boolean; userPrincipalVerified?: boolean; error?: string; receipt?: JsonRecord; evidenceVerified?: boolean };
type ChatTurn = { role: 'user' | 'assistant'; text: string };
type PendingStep = { request: WorkroomExecution; approvalRequestId?: string; label: string };
type Pending = { label: string; steps: PendingStep[] };
type Action = { capability: string; target: string; arguments: JsonRecord; label: string };
type PlannedStep = { capability: string; target: string; makePayload: (planId: string) => JsonRecord; label: string };
const button = 'min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:border-indigo-400';
const field = 'w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-white';
const browserTarget = 'node.cinema-remote';
const desktopTarget = 'node.desktop-native';

export function DsgLiveWorkroom() {
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [status, setStatus] = useState('กำลังตรวจเซสชันสำหรับเครื่องมือ');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const subject = useRef<string | null>(null);
  const [routes, setRoutes] = useState<WorkroomRoute[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [tab, setTab] = useState<'agent' | 'browser' | 'desktop'>('agent');
  const [goal, setGoal] = useState('');
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [proposal, setProposal] = useState<Action | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [receipt, setReceipt] = useState<unknown>(null);
  const history = useRef<JsonRecord[]>([]);
  const [url, setUrl] = useState('https://dsg.pics');
  const [path, setPath] = useState('');
  const [command, setCommand] = useState('');
  const transcript = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch('/api/dsg/identity/link', { credentials: 'include', cache: 'no-store' });
        const link = await response.json();
        if (!response.ok || !link.ok) throw new Error('DSG_WORKSPACE_SESSION_REQUIRED');
        if (live) subject.current = link.principal?.sub ?? null;
        const authenticated = await getDsgBrowserSession().isAuthenticated();
        if (!live) return;
        setReady(authenticated && Boolean(subject.current));
        setStatus(authenticated && subject.current
          ? 'เซสชันเครื่องมือพร้อม กดอ่านเครื่องมือที่ระบบมีอยู่'
          : 'เข้าสู่ระบบเครื่องมือครั้งเดียวเพื่อใช้ Agent v0 และรีโมต');
      } catch {
        if (live) setStatus('ตรวจเซสชันไม่ได้ เปิดหน้าสิทธิ์แล้วเลือก workspace');
      } finally { if (live) setInitializing(false); }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => { transcript.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [chat]);

  async function tool(name: string, args: JsonRecord): Promise<ToolReply> {
    let accessToken: string;
    try {
      const token = await getDsgBrowserSession().getTokenSilently();
      if (!token) throw new Error('AUTH0_TOKEN_UNAVAILABLE');
      accessToken = token;
    }
    catch (error) {
      setReady(false);
      throw new Error(classifyAuth0SessionFailure(error) === 'AUTH0_REFRESH_NOT_AVAILABLE'
        ? 'AUTH0_REAUTH_REQUIRED' : 'AUTH0_TOKEN_UNAVAILABLE');
    }
    const response = await fetch('/api/dsg/spacetime/user-tools', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken, tool: name, arguments: args }),
    });
    const data = await response.json() as ToolReply;
    if (!response.ok || !data.ok || !data.userPrincipalVerified) {
      const reason = data.error ?? String(data.receipt?.reason ?? asRecord(data.receipt?.decision)?.reason ?? 'PROVIDER_REQUEST_NOT_VERIFIED');
      if (response.status === 401) setReady(false);
      throw new Error(reason);
    }
    return data;
  }

  async function act(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await work(); }
    catch (error) {
      const reason = error instanceof Error ? error.message : 'REQUEST_FAILED';
      setStatus(`ยังทำงานไม่สำเร็จ: ${reason} — ตรวจเซสชันหรือสถานะ provider ก่อนลองใหม่`);
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function login() {
    await act(async () => {
      setStatus('กำลังเปิด Auth0 แล้วจะกลับมาหน้า Workroom');
      await getDsgBrowserSession().loginWithRedirect({
        authorizationParams: { redirect_uri: DSG_AUTH0_CALLBACK },
        appState: { returnTo: '/dsg/workroom' },
      });
    });
  }

  async function loadCatalog() {
    setStatus('กำลังอ่านเส้นทางที่ runtime เปิดใช้อยู่');
    const data = await tool('spacetime_capability_catalog', {});
    const found = catalogRoutes(data.receipt?.routes);
    if (!Array.isArray(data.receipt?.routes)) throw new Error('RUNTIME_CATALOG_NOT_RETURNED');
    setRoutes(found);
    setCatalogLoaded(true);
    setStatus('อ่านเครื่องมือแล้ว ต้องตรวจผลจาก provider แยกก่อนสรุปว่าเชื่อมต่อได้');
    return found;
  }

  function agent() {
    if (!subject.current) throw new Error('VERIFIED_AUTH0_SUBJECT_REQUIRED');
    return { agent_id: 'dsg-web-workroom', principal: 'oauth:' + subject.current };
  }

  async function execute(request: WorkroomExecution, label: string, approvalId?: string) {
    setStatus(`กำลัง${label} โปรดรอผลจาก provider`);
    const data = await tool('spacetime_execute', { ...request, ...(approvalId ? { approval_id: approvalId } : {}) });
    if (!await workroomReceiptMatches(data.receipt, request, approvalId)) throw new Error('EXACT_PROVIDER_RECEIPT_NOT_VERIFIED');
    const chain = await tool('spacetime_verify_evidence', {});
    if (!chain.evidenceVerified || chain.receipt?.valid !== true) throw new Error('EVIDENCE_CHAIN_NOT_VERIFIED');
    setReceipt(publicWorkroomReceipt(data.receipt));
    const result = asRecord(data.receipt?.result)!;
    if (typeof request.payload.action === 'string') {
      history.current = [...history.current, {
        action: request.payload.action,
        // Never send file content or shell stdout back to the external planner.
        outcome: 'VERIFIED',
        plan_id: request.plan_id,
        route_id: request.route_id,
        evidence_hash: asRecord(data.receipt?.evidence)?.evidence_hash,
      }].slice(-6);
    }
    setStatus(`${label}: ได้รับผลจาก provider และตรวจสายหลักฐานแล้ว ดูผลด้านล่าง`);
    return result;
  }

  async function preparePlan(steps: PlannedStep[], label: string) {
    const available = catalogLoaded ? routes : await loadCatalog();
    const planId = 'web-' + crypto.randomUUID();
    const selected = steps.map((step) => {
      if (step.target === desktopTarget &&
          !available.some(route => route.capability === step.capability && route.target_node === desktopTarget)) {
        throw new Error('DSG_NATIVE_DESKTOP_NOT_ENROLLED');
      }
      return {
        ...step,
        route: uniqueWorkroomRoute(available, step.capability, step.target),
        payload: step.makePayload(planId),
      };
    });
    const actor = agent();
    const composed = await tool('spacetime_compose', composeWorkroomRoutes(
      selected.map(({ route, payload }) => ({ route, payload })),
      { plan_id: planId, agent: actor },
      label,
    ));
    if (composed.receipt?.verdict !== 'BOUND' || typeof composed.receipt.plan_hash !== 'string') throw new Error('PLAN_NOT_BOUND');
    return selected.map((step) => ({
      label: step.label,
      route: step.route,
      request: {
        plan_id: planId,
        plan_hash: composed.receipt!.plan_hash as string,
        route_id: step.route.route_id,
        agent: actor,
        payload: step.payload,
      },
    }));
  }

  async function runSteps(steps: PlannedStep[], label: string) {
    if (pending) throw new Error('FINISH_OR_CANCEL_PENDING_REQUEST_FIRST');
    const planned = await preparePlan(steps, label);
    const withApprovals: PendingStep[] = [];
    for (const step of planned) {
      if (step.route.approval_required || step.route.signed_approval_required) {
        const approval = await tool('spacetime_request_approval', { request: step.request, ttl_seconds: 600 });
        const view = asRecord(approval.receipt?.approval);
        if (approval.receipt?.verdict !== 'PENDING' || typeof view?.approval_request_id !== 'string') throw new Error('APPROVAL_REQUEST_NOT_CREATED');
        withApprovals.push({ request: step.request, approvalRequestId: view.approval_request_id, label: step.label });
      } else {
        withApprovals.push({ request: step.request, label: step.label });
      }
    }
    if (withApprovals.some(step => step.approvalRequestId)) {
      setPending({ label, steps: withApprovals });
      setStatus(withApprovals.length > 1
        ? 'คำขอชุดเดียวกันพร้อมให้มนุษย์ตรวจ payload เปิดหน้าอนุมัติทุกใบ แล้วกลับมากดดำเนินการต่อ'
        : 'คำขอพร้อมให้มนุษย์ตรวจ payload เปิดหน้าอนุมัติ แล้วกลับมากดดำเนินการต่อ');
      return null;
    }
    let result: JsonRecord | null = null;
    for (const step of withApprovals) result = await execute(step.request, step.label);
    return result;
  }

  async function run(capability: string, target: string, makePayload: (planId: string) => JsonRecord, label: string) {
    return runSteps([{ capability, target, makePayload, label }], label);
  }

  async function resume() {
    if (!pending) return;
    const current = pending;
    const permits = new Map<string, string>();
    for (const step of current.steps) {
      if (!step.approvalRequestId) continue;
      const claim = await tool('spacetime_claim_approval', { approval_request_id: step.approvalRequestId });
      if (claim.receipt?.verdict !== 'APPROVED' || typeof claim.receipt.approval_id !== 'string') throw new Error('HUMAN_APPROVAL_NOT_READY');
      permits.set(step.approvalRequestId, claim.receipt.approval_id);
    }
    // Consume only once. If execution is uncertain, do not replay a mutation.
    setPending(null);
    for (const step of current.steps) {
      await execute(step.request, step.label, step.approvalRequestId ? permits.get(step.approvalRequestId) : undefined);
    }
  }

  const isAvailable = (cap: string, target: string) => routes.some(route => route.capability === cap && route.target_node === target);

  async function sendGoal() {
    const message = goal.trim();
    if (!message || message.length > 4000) return;
    const available = catalogLoaded ? routes : await loadCatalog();
    const contracts = [
      { name: 'browser.remote.status', target: browserTarget, description: 'อ่านสถานะการเชื่อมต่อ Remote Browser', required: [], optional: [], risk: 'read' },
      { name: 'device.remote.status', target: desktopTarget, description: 'อ่านสถานะ DSG Desktop Native ที่ผูกอยู่', required: [], optional: [], risk: 'read' },
      { name: 'device.process.list', target: desktopTarget, description: 'อ่านรายการ process ของ DSG Desktop Native', required: [], optional: [], risk: 'read' },
      { name: 'device.fs.read', target: desktopTarget, description: 'อ่านไฟล์จาก DSG Desktop Native', required: ['path'], optional: ['offset', 'length'], risk: 'read' },
      { name: 'device.shell.exec', target: desktopTarget, description: 'เรียกคำสั่งบน DSG Desktop Native หลังมีแผนและการอนุมัติ', required: ['command'], optional: [], risk: 'high' },
    ].filter(contract => available.some(route => route.capability === contract.name && route.target_node === contract.target));
    if (!contracts.length) throw new Error('NO_LIVE_TOOL_CONTRACTS_FOR_AGENT');
    setChat(items => [...items, { role: 'user', text: message }]);
    setProposal(null);
    setStatus('กำลังส่งเป้าหมายให้ DSG Agent v0');
    const result = await run('action.plan', 'node.agent.dsg-v0', () => ({
      goal: message,
      tools: contracts.map(({ target: _target, ...contract }) => contract),
      verified_history: history.current,
      step: Math.min(history.current.length, 25), request_key: 'chat-' + crypto.randomUUID(),
    }), 'วางแผนด้วย Agent v0');
    if (!result) return;
    if (result.authority !== 'proposal-only' || result.brain_mode !== 'local_qwen3_planner' ||
        typeof result.model !== 'string' || !result.model.startsWith('DSG-Agent-v0')) throw new Error('AGENT_V0_MODEL_NOT_VERIFIED');
    const next = asRecord(result.action_proposal);
    const nextArguments = asRecord(next?.arguments);
    const contract = contracts.find(item => item.name === next?.action);
    if (result.status === 'ACTION_REQUIRED' && contract && nextArguments) {
      setProposal({ capability: contract.name, target: contract.target, arguments: nextArguments, label: contract.description });
      setChat(items => [...items, { role: 'assistant', text: `Agent v0 เสนอให้${contract.description} ตรวจรายละเอียดก่อนกดทำตามแผน` }]);
    } else if (result.status === 'COMPLETED' && typeof asRecord(result.final_result)?.text === 'string') {
      setChat(items => [...items, { role: 'assistant', text: String(asRecord(result.final_result)!.text) }]);
    } else throw new Error('AGENT_V0_PROPOSAL_NOT_SUPPORTED');
    setGoal('');
  }

  async function browserConnect() {
    await run('browser.remote.connect', browserTarget, planId => ({ action: 'browser.remote.connect', arguments: {
      plan_id: planId, agent_identity: agent().agent_id, step_id: 'connect', ttl_seconds: 600,
    } }), 'เชื่อม Remote Browser');
  }

  async function browserNavigate() {
    const destination = new URL(url);
    if (!['https:', 'http:'].includes(destination.protocol) || destination.username || destination.password) throw new Error('PUBLIC_BROWSER_URL_REQUIRED');
    await runSteps([
      {
        capability: 'browser.remote.connect',
        target: browserTarget,
        label: 'เชื่อม Remote Browser',
        makePayload: planId => ({ action: 'browser.remote.connect', arguments: {
          plan_id: planId, agent_identity: agent().agent_id, step_id: 'connect', ttl_seconds: 600,
        } }),
      },
      {
        capability: 'browser.remote.execute',
        target: browserTarget,
        label: 'เปิดหน้าเว็บและอ่านผล',
        makePayload: planId => ({ action: 'browser.remote.run', arguments: {
          plan_id: planId, agent_identity: agent().agent_id, stop_on_success: false,
          steps: [
            { step_id: 'navigate', action: { kind: 'browser.navigate', controller: 'agent_executor', parameters: { url: destination.href } } },
            { step_id: 'inspect', action: { kind: 'browser.extract', controller: 'agent_verifier', parameters: {} } },
          ],
        } }),
      },
    ], 'เชื่อม Browser เปิดเว็บ และอ่านผลในแผนเดียว');
  }

  return (
    <section id="live-controls" className="scroll-mt-20 rounded-3xl border border-indigo-400/30 bg-slate-900 p-5 md:p-6" aria-label="เครื่องมือ Workroom">
      <h2 className="text-2xl font-bold">Agent v0 · Remote Browser · Remote Desktop</h2>
      <p className="mt-2 text-sm text-slate-400">พิมพ์เป้าหมาย ตรวจแผน และดูผลจากเครื่องมือที่เชื่อมอยู่</p>
      <p role="status" aria-live="polite" className="mt-4 break-words rounded-xl bg-slate-950 p-4 text-sm text-indigo-100">{status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!ready && <button className={button} disabled={busy || initializing} onClick={() => void login()}>เข้าสู่ระบบเครื่องมือ</button>}
        <button className={button} disabled={busy || !ready} onClick={() => void act(async () => { await loadCatalog(); })}>อ่านเครื่องมือที่เชื่อมอยู่</button>
        <a href="/dsg/access" className={button}>สิทธิ์ workspace</a>
      </div>
      <div role="tablist" aria-label="เลือกเครื่องมือ" className="mt-6 flex flex-wrap gap-2">
        {(['agent', 'browser', 'desktop'] as const).map((item, index) => (
          <button key={item} role="tab" id={`workroom-tab-${item}`} aria-controls={`workroom-panel-${item}`} aria-selected={tab === item}
            onClick={() => setTab(item)} className={`${button} ${tab === item ? 'bg-indigo-700 border-indigo-400' : ''}`}>
            {['แชท Agent v0', 'Remote Browser', 'Remote Desktop'][index]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`workroom-panel-${tab}`} aria-labelledby={`workroom-tab-${tab}`} className="mt-5 space-y-4">
        {tab === 'agent' && <>
          <p className="text-sm text-slate-300">บอกสิ่งที่ต้องการ เช่น “ตรวจว่ารีโมตเดสก์ท็อปเชื่อมอยู่ไหม” Agent v0 จะเสนอขั้นตอนจากเครื่องมือที่ระบบมี</p>
          <div role="log" aria-label="บทสนทนา Agent v0" aria-live="polite" className="max-h-80 space-y-3 overflow-y-auto">
            {chat.map((turn, index) => <p key={index} className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${turn.role === 'user' ? 'bg-indigo-900/60' : 'bg-slate-950'}`}><strong>{turn.role === 'user' ? 'คุณ' : 'Agent v0'}: </strong>{turn.text}</p>)}
            <div ref={transcript} />
          </div>
          <form onSubmit={event => { event.preventDefault(); void act(sendGoal); }} className="space-y-3">
            <label htmlFor="workroom-goal" className="block text-sm font-semibold">เป้าหมายของคุณ</label>
            <textarea id="workroom-goal" value={goal} onChange={event => setGoal(event.target.value)} maxLength={4000} rows={3} className={field} placeholder="พิมพ์คำสั่งเป็นภาษาธรรมชาติ…" />
            <button type="submit" className={`${button} bg-indigo-700`} disabled={!ready || busy || !goal.trim() || Boolean(pending)}>{busy ? 'กำลังทำงาน…' : 'ส่งให้ Agent v0'}</button>
          </form>
          {proposal && <div className="rounded-xl border border-indigo-400 p-4">
            <p className="font-semibold">ขั้นตอนที่เสนอ: {proposal.label}</p>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(publicWorkroomReceipt(proposal.arguments), null, 2)}</pre>
            <button className={`${button} mt-3`} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => {
              await run(proposal.capability, proposal.target, () => ({ action: proposal.capability, arguments: proposal.arguments }), proposal.label);
              setProposal(null);
            })}>ทำตามขั้นตอนนี้</button>
          </div>}
        </>}
        {tab === 'browser' && <>
          <p className="text-sm text-slate-300">ใช้ Cinema บน AWS เดิม การเชื่อมและการควบคุมต้องผ่านคำขออนุมัติที่ผูกกับแผน</p>
          {catalogLoaded && !isAvailable('browser.remote.status', browserTarget) && <p className="text-amber-200">runtime ยังไม่เปิดเส้นทาง Browser — ตรวจ deployment ก่อนเชื่อม</p>}
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await run('browser.remote.status', browserTarget, () => ({ action: 'browser.remote.status', arguments: {} }), 'อ่านสถานะ Browser'); })}>ตรวจสถานะ Browser</button>
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(browserConnect)}>ขอเชื่อม Browser</button>
            <a href="https://aws.dsg.pics/app" target="_blank" rel="noreferrer" className={button}>เปิด Shared Browser ↗</a>
          </div>
          <label htmlFor="workroom-browser-url" className="block text-sm font-semibold">เว็บที่จะเปิด</label>
          <input id="workroom-browser-url" type="url" value={url} onChange={event => setUrl(event.target.value)} className={field} />
          <button className={button} disabled={busy || !ready || Boolean(pending) || !url.trim()} onClick={() => void act(browserNavigate)}>ขอเชื่อม เปิดเว็บ และอ่านผล</button>
        </>}
        {tab === 'desktop' && <>
          <p className="text-sm text-slate-300">ส่งคำสั่งผ่าน DSG Desktop Native ที่ผูกกับ runtime โดยตรง ระบบจะไม่ fallback ไป hosted RDC</p>
          {catalogLoaded && !isAvailable('device.remote.status', desktopTarget) && <p className="text-amber-200">DSG Desktop Native ยังไม่ได้ enroll กับ runtime — จับคู่เครื่องก่อนใช้งาน</p>}
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await run('device.remote.status', desktopTarget, () => ({ action: 'device.remote.status', arguments: {} }), 'ตรวจ Remote Desktop'); })}>ตรวจ Remote Desktop</button>
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await run('device.process.list', desktopTarget, () => ({ action: 'device.process.list', arguments: {} }), 'อ่านรายการ process'); })}>อ่านรายการ process</button>
            <a href="/control/" target="_blank" rel="noreferrer" className={button}>จับคู่ Desktop ↗</a>
          </div>
          <label htmlFor="workroom-file-path" className="block text-sm font-semibold">ไฟล์ที่จะอ่าน</label>
          <input id="workroom-file-path" value={path} onChange={event => setPath(event.target.value)} className={field} placeholder="พาธในอุปกรณ์ที่ผูกไว้" />
          <button className={button} disabled={busy || !ready || Boolean(pending) || !path.trim()} onClick={() => void act(async () => { await run('device.fs.read', desktopTarget, () => ({ action: 'device.fs.read', arguments: { path: path.trim(), length: 100 } }), 'อ่านไฟล์จาก Desktop'); })}>อ่านไฟล์</button>
          <label htmlFor="workroom-shell-command" className="block text-sm font-semibold">คำสั่งที่จะให้ Desktop ทำ</label>
          <textarea id="workroom-shell-command" rows={2} value={command} onChange={event => setCommand(event.target.value)} className={field} />
          <button className={button} disabled={busy || !ready || Boolean(pending) || !command.trim()} onClick={() => void act(async () => { await run('device.shell.exec', desktopTarget, () => ({ action: 'device.shell.exec', arguments: { command: command.trim() } }), 'เรียกคำสั่งบน Desktop'); })}>ขออนุมัติคำสั่ง</button>
        </>}
      </div>
      {pending && <section className="mt-5 rounded-xl border border-amber-400/50 p-4" aria-label="งานรออนุมัติ">
        <h3 className="font-bold text-amber-100">รอมนุษย์อนุมัติ: {pending.label}</h3>
        <p className="mt-2 text-sm text-slate-300">ตรวจรายละเอียดในหน้าอนุมัติที่เปิดแยก แล้วกลับมาทำงานต่อภายใน 10 นาที</p>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(publicWorkroomReceipt(pending.steps.map(step => ({
          label: step.label,
          approval_request_id: step.approvalRequestId,
          route_id: step.request.route_id,
          payload: step.request.payload,
        }))), null, 2)}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/dsg/approvals" target="_blank" rel="noreferrer" className={button}>เปิดหน้าอนุมัติ ↗</a>
          <button className={button} disabled={busy || !ready} onClick={() => void act(resume)}>ดำเนินการต่อหลังอนุมัติ</button>
          <button className={button} disabled={busy} onClick={() => { setPending(null); setStatus('หยุดรอในหน้านี้ คำขอที่ยังไม่อนุมัติจะหมดอายุเอง'); }}>หยุดรอ</button>
        </div>
      </section>}
      {receipt != null && <details open className="mt-5 rounded-xl border border-slate-700 p-4">
        <summary className="cursor-pointer font-semibold">ผลล่าสุดจาก provider</summary>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-300">{JSON.stringify(receipt, null, 2)}</pre>
      </details>}
    </section>
  );
}
