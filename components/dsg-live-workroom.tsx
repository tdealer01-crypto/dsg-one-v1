'use client';

import { useEffect, useRef, useState } from 'react';
import { getDsgBrowserSession, DSG_AUTH0_CALLBACK } from '@/lib/dsg/user-bound/browser-session';
import { classifyAuth0SessionFailure } from '@/lib/dsg/user-bound/oauth-refresh';
import { DsgKaggleGpuStatus } from '@/components/dsg-kaggle-gpu-status';
import { shouldRequestKaggleWake } from '@/lib/dsg/user-bound/kaggle-on-demand';
import { agentCapabilityReadiness } from '@/lib/dsg/user-bound/agent-capability-readiness';
import { DsgCinemaOauthViewer } from '@/components/dsg-cinema-oauth-viewer';
import { cinemaAgentToolContracts, cinemaNavigationSteps, cinemaVerifierKind, cinemaVerifierObservation, cinemaVerifierReadPayload } from '@/lib/dsg/user-bound/cinema-controller-contract';
import { nativeShellOutcome } from '@/lib/dsg/user-bound/native-shell-outcome';
import { nativeDeviceSummary, type NativeDeviceSummary } from '@/lib/dsg/user-bound/native-device-summary';
import { isVerifiedCinemaConnectResult, mayReuseRecentCinemaConnection } from '@/lib/dsg/user-bound/cinema-session-reuse';
import { describeWorkroomFailure } from '@/lib/dsg/user-bound/workroom-failure';
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
type FlowPhase = 'goal' | 'plan' | 'approval' | 'execute' | 'verify' | 'evidence' | 'needs-check';
const flowStages: { phase: FlowPhase; label: string }[] = [
  { phase: 'goal', label: 'เป้าหมาย' }, { phase: 'plan', label: 'แผน' },
  { phase: 'approval', label: 'อนุมัติเมื่อจำเป็น' }, { phase: 'execute', label: 'ทำงาน' },
  { phase: 'verify', label: 'ตรวจผล' }, { phase: 'evidence', label: 'หลักฐาน' },
];
const button = 'min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:border-indigo-400';
const field = 'w-full rounded-xl border border-slate-500 bg-slate-950 p-3 text-sm text-white';
const browserTarget = 'node.cinema-remote';
const desktopTarget = 'node.desktop-native';

function approvalHref(approvalRequestId?: string): string {
  return approvalRequestId
    ? `/dsg/approvals?approval_request_id=${encodeURIComponent(approvalRequestId)}`
    : '/dsg/approvals';
}

export function DsgLiveWorkroom() {
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [status, setStatus] = useState('กำลังตรวจเซสชันสำหรับเครื่องมือ');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const cinemaConnectedVerifiedAt = useRef(0);
  const subject = useRef<string | null>(null);
  const [routes, setRoutes] = useState<WorkroomRoute[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [frameworkProbe, setFrameworkProbe] = useState<'not-checked' | 'reported-ready' | 'unverified'>('not-checked');
  const [frameworkVersion, setFrameworkVersion] = useState('');
  const [tab, setTab] = useState<'agent' | 'browser' | 'desktop'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tool') === 'browser' ? 'browser' :
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tool') === 'desktop' ? 'desktop' : 'agent'
  );
  const [goal, setGoal] = useState('');
  const [kaggleLaunchRevision, setKaggleLaunchRevision] = useState(0);
  const awaitingKaggleForGoal = useRef<string | null>(null);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [proposal, setProposal] = useState<Action | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [receipt, setReceipt] = useState<unknown>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('goal');
  const [observedPage, setObservedPage] = useState<{ url: string; title: string } | null>(null);
  const history = useRef<JsonRecord[]>([]);
  const [url, setUrl] = useState('https://dsg.pics');
  const [path, setPath] = useState('');
  const [command, setCommand] = useState('');
  const transcript = useRef<HTMLDivElement | null>(null);
  const [verifiedAction, setVerifiedAction] = useState<string | null>(null);
  const [shellProcessId, setShellProcessId] = useState<string | null>(null);
  const [shellOutcome, setShellOutcome] = useState<'running' | 'succeeded' | 'failed' | 'unknown' | null>(null);
  const [nativeDevice, setNativeDevice] = useState<NativeDeviceSummary | null>(null);

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
      setFlowPhase('needs-check');
      setStatus(describeWorkroomFailure(error));
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function beginLoginRedirect() {
    setStatus('กำลังเปิด Auth0 แล้วจะกลับมาหน้า Workroom');
    try {
      await getDsgBrowserSession().loginWithRedirect({
        authorizationParams: { redirect_uri: DSG_AUTH0_CALLBACK },
        appState: { returnTo: window.location.pathname + window.location.search },
      });
    } catch (error) {
      setStatus(describeWorkroomFailure(error));
      throw error;
    }
  }

  async function login() {
    await act(beginLoginRedirect);
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

  async function checkAgentComponents() {
    // Existing authenticated catalog is the only source of route availability.
    await loadCatalog();
    // This is a reported process/engine health probe, not an agent-run E2E proof.
    setFrameworkProbe('unverified');
    setFrameworkVersion('');
    try {
      const response = await fetch('/api/agent/status', { cache: 'no-store', credentials: 'include' });
      const raw = asRecord(await response.json());
      const engine = asRecord(asRecord(raw?.readiness)?.automationEngine);
      const reported = response.ok && raw?.ok === true && engine?.ok === true &&
        engine.engine === 'microsoft-agent-framework' && engine.version === '1.18.0';
      if (reported) {
        setFrameworkVersion('1.18.0');
        setFrameworkProbe('reported-ready');
      }
    } catch {
      // Unverified never becomes success through a network exception.
    }
    setStatus('อ่านแคตตาล็อกและ Framework Health แล้ว · สถานะ Route ไม่ได้พิสูจน์ว่าทำงาน E2E สำเร็จ');
  }

  const capabilityReports = agentCapabilityReadiness(routes);

  function agent() {
    if (!subject.current) throw new Error('VERIFIED_AUTH0_SUBJECT_REQUIRED');
    return { agent_id: 'dsg-web-workroom', principal: 'oauth:' + subject.current };
  }

  async function execute(request: WorkroomExecution, label: string, approvalId?: string) {
    setFlowPhase('execute');
    setStatus(`กำลัง${label} โปรดรอผลจาก provider`);
    const data = await tool('spacetime_execute', { ...request, ...(approvalId ? { approval_id: approvalId } : {}) });
    setFlowPhase('verify');
    if (!await workroomReceiptMatches(data.receipt, request, approvalId)) throw new Error('EXACT_PROVIDER_RECEIPT_NOT_VERIFIED');
    const chain = await tool('spacetime_verify_evidence', {});
    if (!chain.evidenceVerified || chain.receipt?.valid !== true) throw new Error('EVIDENCE_CHAIN_NOT_VERIFIED');
    const result = asRecord(data.receipt?.result)!;
    if (request.route_id === 'route.desktop-native.status') setNativeDevice(nativeDeviceSummary(result));
    const browserArguments = asRecord(request.payload.arguments);
    if (request.route_id === 'route.cinema-remote.read' && Array.isArray(browserArguments?.steps) &&
        browserArguments.steps.some(step => asRecord(asRecord(step)?.action)?.kind === 'browser.extract')) {
      const observation = cinemaVerifierObservation(result, request.plan_id, request.plan_hash);
      if (!observation) throw new Error('CINEMA_VERIFIER_POSTCONDITION_NOT_VERIFIED');
      setObservedPage(observation);
    }
    setReceipt(publicWorkroomReceipt(data.receipt));
    setFlowPhase('evidence');
    setVerifiedAction(label);
    if (request.route_id === 'route.cinema-remote.connect') {
      // This timestamp is ephemeral. We never persist approval permits or
      // assume a provider is connected without its independent status proof.
      cinemaConnectedVerifiedAt.current = isVerifiedCinemaConnectResult(result) ? Date.now() : 0;
    }
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
    if (request.route_id === 'route.desktop-native.shell-exec') {
      // Provider evidence proves dispatch, not command exit success.
      const outcome = nativeShellOutcome(result);
      setShellOutcome(outcome.state);
      if (outcome.state !== 'succeeded') setFlowPhase('needs-check');
      setShellProcessId(outcome.state === 'running' ? outcome.processId : null);
      if (outcome.state === 'succeeded') setStatus('คำสั่งทำงานเสร็จ (exit code 0) และตรวจหลักฐานแล้ว');
      else if (outcome.state === 'failed') setStatus('คำสั่งสิ้นสุดด้วย exit code ' + outcome.exitCode + ' · ดูผลด้านล่าง');
      else if (outcome.state === 'running') setStatus('ส่งคำสั่งแล้ว · อุปกรณ์กำลังทำงาน รอตรวจ Exit Code');
      else setStatus('ส่งคำสั่งแล้ว แต่ยังยืนยันผลลัพธ์ของโปรเซสไม่ได้ (ไม่สั่งซ้ำ)');
    } else {
      setStatus(`${label}: ได้รับผลจาก provider และตรวจสายหลักฐานแล้ว ดูผลด้านล่าง`);
    }
    return result;
  }

  async function preparePlan(steps: PlannedStep[], label: string) {
    setFlowPhase('plan');
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
    setVerifiedAction(null);
    setReceipt(null);
    setObservedPage(null);
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
      setFlowPhase('approval');
      setPending({ label, steps: withApprovals });
      setStatus(withApprovals.length > 1
        ? 'รออนุมัติตามรายการด้านล่าง เมื่อครบแล้วกลับมาเพื่อทำงานต่อ'
        : 'รออนุมัติ 1 คำขอ เปิดหน้าตรวจคำสั่งแล้วกลับมา ระบบจะพยายามทำงานต่ออัตโนมัติ');
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
    setFlowPhase('approval');
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

  async function checkShellProcess() {
    if (!shellProcessId) return;
    const expectedProcessId = shellProcessId;
    const planned = await preparePlan([{
      capability: 'device.process.list', target: desktopTarget,
      makePayload: () => ({ action: 'device.process.list', arguments: {} }),
      label: 'ตรวจผลคำสั่งที่กำลังทำงาน',
    }], 'ติดตาม Native Shell ผ่าน Route อ่านรายการโปรเซสเดิม');
    const result = await execute(planned[0].request, 'ตรวจผลคำสั่ง');
    const outcome = nativeShellOutcome(result, expectedProcessId);
    setShellOutcome(outcome.state);
    setFlowPhase(outcome.state === 'succeeded' ? 'evidence' : 'needs-check');
    if (outcome.state === 'succeeded') {
      setShellProcessId(null);
      setStatus('คำสั่งเสร็จสำเร็จ (exit code 0) · ตรวจผลผ่าน Native Provider และ Evidence แล้ว');
    } else if (outcome.state === 'failed') {
      setShellProcessId(null);
      setStatus('คำสั่งจบด้วย exit code ' + outcome.exitCode + ' · ดูข้อความจากโปรเซสในผลลัพธ์');
    } else if (outcome.state === 'running') {
      setStatus('โปรเซสยังทำงานอยู่ · สามารถตรวจผลอีกครั้งได้');
    } else {
      setStatus('ยังยืนยันผลคำสั่งนี้ไม่ได้ ไม่สั่ง Shell ซ้ำ');
    }
  }

  useEffect(() => {
    if (!ready || !shellProcessId || shellOutcome !== 'running') return;
    // One automatic read-only readback. Do not re-dispatch the shell command.
    const timer = window.setTimeout(() => {
      if (!busyRef.current) void act(checkShellProcess);
    }, 4000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shellProcessId, shellOutcome]);

  function selectTool(item: 'agent' | 'browser' | 'desktop') {
    setTab(item);
    // Persist only the chosen UI route, never auth tokens, shell commands or permits.
    const next = new URL(window.location.href);
    if (item === 'agent') next.searchParams.set('tool', 'agent-v0');
    else next.searchParams.set('tool', item);
    window.history.replaceState(window.history.state, '', next.pathname + next.search + next.hash);
  }

  const isAvailable = (cap: string, target: string) => routes.some(route => route.capability === cap && route.target_node === target);

  useEffect(() => {
    // Reconcile any existing approval when the user returns from Auth0/owner
    // review, including Cinema. Never create an additional approval here.
    // Without a durable execution lease, we do not replay work after reload.
    if (!pending || !ready || !pending.steps.some(step => step.approvalRequestId)) return;
    const onReturn = () => {
      if (!document.hidden && !busyRef.current) {
        // A single claim attempt on return; the backend must prove APPROVED.
        // Execute is one-shot after claim. No polling/new approvals on failures.
        void act(resume);
      }
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
    // Listener is scoped to already-created exact requests and authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, ready]);

  async function sendGoal() {
    const message = goal.trim();
    if (!message || message.length > 4000) return;
    const available = catalogLoaded ? routes : await loadCatalog();
    const contracts = [
      { name: 'browser.remote.status', target: browserTarget, description: 'อ่านสถานะการเชื่อมต่อ Remote Browser', required: [], optional: [], risk: 'read' },
      ...cinemaAgentToolContracts(browserTarget),
      { name: 'device.remote.status', target: desktopTarget, description: 'อ่านสถานะ DSG Desktop Native ที่ผูกอยู่', required: [], optional: [], risk: 'read' },
      { name: 'device.process.list', target: desktopTarget, description: 'อ่านรายการ process ของ DSG Desktop Native', required: [], optional: [], risk: 'read' },
      { name: 'device.fs.read', target: desktopTarget, description: 'อ่านไฟล์จาก DSG Desktop Native', required: ['path'], optional: ['offset', 'length'], risk: 'read' },
      { name: 'device.fs.write', target: desktopTarget, description: 'เขียนไฟล์ผ่าน Signed Approval ของ DSG Native เดิม', required: ['path', 'content'], optional: [], risk: 'high' },
      { name: 'device.shell.exec', target: desktopTarget, description: 'เรียกคำสั่งบน DSG Desktop Native หลังมีแผนและการอนุมัติ', required: ['command'], optional: [], risk: 'high' },
    ].filter(contract => available.some(route => route.capability === contract.name && route.target_node === contract.target));
    if (!contracts.length) throw new Error('NO_LIVE_TOOL_CONTRACTS_FOR_AGENT');

    if (awaitingKaggleForGoal.current !== message) {
      setChat(items => [...items, { role: 'user', text: message }]);
    }
    setProposal(null);
    setStatus('กำลังส่งเป้าหมายให้ DSG Agent v0');
    let result: JsonRecord | null;
    try {
      result = await run('action.plan', 'node.agent.dsg-v0', () => ({
        goal: message,
        tools: contracts.map(({ target: _target, ...contract }) => contract),
        verified_history: history.current,
        step: Math.min(history.current.length, 25), request_key: 'chat-' + crypto.randomUUID(),
      }), 'วางแผนด้วย Agent v0');
    } catch (error) {
      if (!shouldRequestKaggleWake(error)) throw error;
      setFlowPhase('needs-check');
      setStatus('Brain ยังไม่พร้อม กำลังตรวจสิทธิ์เจ้าของเพื่อขอเปิด Kaggle ฟรี');
      const accessToken = await getDsgBrowserSession().getTokenSilently();
      if (!accessToken) throw new Error('AUTH0_TOKEN_UNAVAILABLE');
      const response = await fetch('/api/dsg/agent-v0/launch', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start_free_gpu', accessToken }),
      });
      const raw = await response.json().catch(() => null);
      const outcome = asRecord(raw);
      const code = typeof outcome?.error === 'string' && /^[A-Z0-9_]{3,100}$/.test(outcome.error)
        ? outcome.error : 'KAGGLE_OWNER_DISPATCH_UNAVAILABLE';
      if (response.status === 202 && outcome?.ok === true && outcome.status === 'OWNER_DISPATCH_ACCEPTED') {
        awaitingKaggleForGoal.current = message;
        setKaggleLaunchRevision(current => current + 1);
        setStatus('ส่งคำขอเปิด Kaggle แล้ว · ยังไม่มีหลักฐานว่า Worker พร้อมใช้ เก็บเป้าหมายไว้ให้กดวางแผนซ้ำหลังตรวจสถานะ');
        return;
      }
      if (response.status === 409 && code === 'KAGGLE_LAUNCH_ALREADY_IN_PROGRESS') {
        awaitingKaggleForGoal.current = message;
        setKaggleLaunchRevision(current => current + 1);
        setStatus('มีคำขอเปิด Kaggle อยู่แล้ว · ไม่เปิดซ้ำ ให้ตรวจ Worker ก่อนลองทำงานต่อ');
        return;
      }
      throw new Error(code);
    }
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
    awaitingKaggleForGoal.current = null;
    setGoal('');
  }

  async function browserConnect() {
    // A second tap during the same verified connection is not a new user task.
    // Do not create a duplicate owner approval for an already-connected browser.
    if (mayReuseRecentCinemaConnection(cinemaConnectedVerifiedAt.current, Date.now())) {
      setStatus('Cinema เชื่อมต่อแล้วในเซสชันที่ตรวจไว้ · สั่งงานได้โดยใช้ Signed Approval ของคำสั่งนั้น ไม่ต้องขอ Connect ซ้ำ');
      return;
    }
    await run('browser.remote.connect', browserTarget, planId => ({ action: 'browser.remote.connect', arguments: {
      plan_id: planId, agent_identity: agent().agent_id, step_id: 'connect', ttl_seconds: 600,
    } }), 'เชื่อม Remote Browser');
  }

  async function browserVerifier(kind: 'browser.extract' | 'browser.screenshot') {
    await run('browser.remote.read', browserTarget,
      planId => cinemaVerifierReadPayload(planId, agent().agent_id, kind),
      kind === 'browser.screenshot' ? 'ตรวจภาพหน้าเว็บด้วย Agent Verifier' : 'อ่านหน้าเว็บด้วย Agent Verifier');
  }

  async function executeAgentProposal(action: Action) {
    // Planner selects intent, but Workroom constructs the exact plan-bound
    // controller payload. Model proposals cannot mint permits or credentials.
    if (action.capability === 'browser.remote.read') {
      await browserVerifier(cinemaVerifierKind(action.arguments.kind));
      return;
    }
    if (action.capability === 'browser.remote.connect') {
      await browserConnect();
      return;
    }
    if (action.capability === 'browser.remote.execute') {
      if (typeof action.arguments.url !== 'string') throw new Error('PUBLIC_BROWSER_URL_REQUIRED');
      await browserNavigate(action.arguments.url);
      return;
    }
    await run(action.capability, action.target,
      () => ({ action: action.capability, arguments: action.arguments }), action.label);
  }

  async function browserNavigate(targetUrl: string = url) {
    const steps: PlannedStep[] = cinemaNavigationSteps(targetUrl, agent().agent_id,
      !mayReuseRecentCinemaConnection(cinemaConnectedVerifiedAt.current, Date.now()));
    await runSteps(steps, 'เปิดเว็บและอ่านผลตามสิทธิ์ที่ตรวจแล้ว');
  }

  return (
    <section id="live-controls" className="scroll-mt-20 rounded-3xl border border-indigo-400/30 bg-slate-900 p-5 md:p-6" aria-label="เครื่องมือ Workroom">
      <h2 className="text-2xl font-bold">DSG Agent v0 · ควบคุมเว็บและอุปกรณ์</h2>
      <ol aria-label="ลำดับงานเดียวกันสำหรับ Agent Browser และ Native" className="my-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        {flowStages.map((stage, index) => <li key={stage.phase}
          aria-current={flowPhase === stage.phase ? 'step' : undefined}
          className={`rounded-lg border p-2 ${flowPhase === stage.phase ? 'border-indigo-300 text-indigo-100' : 'border-slate-700 text-slate-400'}`}>
          {index + 1}. {stage.label}
        </li>)}
      </ol>
      {flowPhase === 'needs-check' && <p className="mb-3 text-sm text-amber-200">ต้องตรวจผลหรือแก้สาเหตุตามข้อความด้านล่างก่อนทำต่อ · ไม่ส่งคำสั่งเดิมซ้ำอัตโนมัติ</p>}
      <p className="mt-2 text-sm text-slate-300">เลือกงาน → ตรวจสิทธิ์ → อนุมัติเฉพาะเมื่อจำเป็น → ดูผลและหลักฐานจริง</p>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 break-words rounded-xl bg-slate-950 p-4 text-sm text-indigo-100">{status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!ready && <button className={button} disabled={busy || initializing} onClick={() => void login()}>เข้าสู่ระบบเครื่องมือ</button>}
        <details className="rounded-xl border border-slate-700 p-2 text-sm"><summary className="cursor-pointer px-2 py-1">การเชื่อมต่อ (ขั้นสูง)</summary><button className={`${button} mt-2`} disabled={busy || !ready} onClick={() => void act(async () => { await loadCatalog(); })}>ตรวจรายการเครื่องมือ</button></details>
        <a href="/dsg/access" className={button}>บัญชีและพื้นที่ทำงาน</a>
      </div>
      <div role="tablist" aria-label="เลือกเครื่องมือ" className="mt-6 flex flex-wrap gap-2">
        {(['agent', 'browser', 'desktop'] as const).map((item, index) => (
          <button key={item} role="tab" id={`workroom-tab-${item}`} aria-controls={`workroom-panel-${item}`} aria-selected={tab === item}
            tabIndex={tab === item ? 0 : -1}
            onKeyDown={event => {
              const items = ['agent', 'browser', 'desktop'] as const;
              const index = items.indexOf(item);
              const next = event.key === 'ArrowRight' ? items[(index + 1) % items.length] :
                event.key === 'ArrowLeft' ? items[(index + items.length - 1) % items.length] :
                event.key === 'Home' ? items[0] : event.key === 'End' ? items[items.length - 1] : null;
              if (next) {
                event.preventDefault();
                selectTool(next);
                document.getElementById(`workroom-tab-${next}`)?.focus();
              }
            }}
            onClick={() => selectTool(item)} className={`${button} ${tab === item ? 'bg-indigo-700 border-indigo-400' : ''}`}>
            {['Agent v0 · วางแผนด้วย Qwen', 'ควบคุมเว็บ', 'สั่งงานอุปกรณ์'][index]}
          </button>
        ))}
      </div>
      {(['agent', 'browser', 'desktop'] as const).filter(item => item !== tab).map(item =>
        <div key={item} role="tabpanel" hidden id={`workroom-panel-${item}`} aria-labelledby={`workroom-tab-${item}`} />
      )}
      <div role="tabpanel" tabIndex={0} id={`workroom-panel-${tab}`} aria-labelledby={`workroom-tab-${tab}`} className="mt-5 space-y-4">
        {tab === 'agent' && <>
          <p className="text-sm text-slate-300">DSG Agent v0 ใช้ Qwen เพื่อเสนอแผนผ่าน AWS Spacetime ไม่ได้อนุมัติหรือลงมือทำเอง หาก Kaggle Worker ไม่ออนไลน์จะแสดงข้อผิดพลาดตามจริง</p>
          <p className="text-xs text-amber-200">สถานะ Route ไม่เท่ากับโมเดลพร้อมใช้ · Qwen3-30B-A3B เป็น Worker ชั่วคราวบน Kaggle (proposal-only)</p>
          <button type="button" className={button} onClick={() => selectTool('browser')}>
            Shared Browser / Multi-Controller · เปิดเครื่องมือที่ใช้ร่วมกับ Agent
          </button>
          <DsgKaggleGpuStatus key={kaggleLaunchRevision} />
          <details className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Core Spin · Physics · Repair · Brain · Framework · Memory</summary>
            <p className="mt-2 text-slate-400">ผลตรวจเป็นการลงทะเบียน Route และ Health ที่รายงานเท่านั้น ไม่ใช่หลักฐานว่าโมเดล, GPU, Provider หรือ Memory E2E ผ่าน</p>
            <button type="button" className={`${button} mt-3`} disabled={busy || !ready}
              onClick={() => void act(checkAgentComponents)}>ตรวจทุกฟังก์ชันจาก Runtime จริง</button>
            <ul className="mt-3 space-y-2">
              <li className="rounded-lg border border-slate-800 p-3">
                <strong>Microsoft Agent Framework</strong>
                <span className="ml-2 text-amber-200">{frameworkProbe === 'reported-ready'
                  ? `Health รายงานพร้อม v${frameworkVersion}`
                  : frameworkProbe === 'not-checked' ? 'ยังไม่ตรวจ' : 'ยังยืนยัน Health ไม่ได้'}</span>
                <p className="mt-1 text-xs text-slate-400">กระบวนการ Framework พร้อมไม่เท่ากับ Core Spin งานจริงผ่าน</p>
              </li>
              {capabilityReports.map(item => <li key={item.id} className="rounded-lg border border-slate-800 p-3">
                <strong>{item.label}</strong>
                <span className={`ml-2 ${catalogLoaded && item.registered ? 'text-sky-300' : 'text-amber-200'}`}>
                  {!catalogLoaded ? 'ยังไม่ตรวจ' : item.registered ? 'ลงทะเบียน Route แล้ว' : 'ยังไม่พบ Route'}
                </span>
                <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                {catalogLoaded && item.routeId && <p className="mt-1 break-all font-mono text-xs text-slate-500">{item.routeId}</p>}
              </li>)}
            </ul>
          </details>
          <div role="log" aria-label="บทสนทนา Agent v0" aria-live="polite" className="max-h-80 space-y-3 overflow-y-auto">
            {chat.map((turn, index) => <p key={index} className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${turn.role === 'user' ? 'bg-indigo-900/60' : 'bg-slate-950'}`}><strong>{turn.role === 'user' ? 'คุณ' : 'Agent v0'}: </strong>{turn.text}</p>)}
            <div ref={transcript} />
          </div>
          <form onSubmit={event => { event.preventDefault(); void act(sendGoal); }} className="space-y-3">
            <label htmlFor="workroom-goal" className="block text-sm font-semibold">ให้ DSG Agent v0 วางแผนงานอะไร</label>
            <textarea id="workroom-goal" value={goal} onChange={event => setGoal(event.target.value)} maxLength={4000} rows={3} className={field} placeholder="เช่น ตรวจสถานะ Cinema หรือช่วยวางแผนอ่านไฟล์บน DSG Native" />
            <button type="submit" className={`${button} bg-indigo-700`} disabled={!ready || busy || !goal.trim() || Boolean(pending)}>{busy ? 'กำลังตรวจ Brain จริง…' : 'วางแผนด้วย Agent v0'}</button>
          </form>
          {proposal && <div className="rounded-xl border border-indigo-400 p-4">
            <p className="font-semibold">ขั้นตอนที่เสนอ: {proposal.label}</p>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(publicWorkroomReceipt(proposal.arguments), null, 2)}</pre>
            <button className={`${button} mt-3`} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => {
              await executeAgentProposal(proposal);
              setProposal(null);
            })}>ทำตามขั้นตอนนี้</button>
          </div>}
        </>}
        {tab === 'browser' && <>
          <p className="text-sm text-slate-300">ใช้ Cinema บน AWS เดิม การเชื่อมและการควบคุมต้องผ่านคำขออนุมัติที่ผูกกับแผน</p>
          <p className="text-xs text-slate-400">Human Viewer: ต้องยืนยันบัญชี Cinema เดิม · Agent Executor: ควบคุมตามแผนที่อนุมัติ · Agent Verifier: อ่านหน้าเว็บ/ภาพหน้าจอเท่านั้น ทั้งสามบทบาทใช้โปรไฟล์ Browser เดียวกันเมื่อการผูกเซสชันผ่านการตรวจสอบ</p>
          <DsgCinemaOauthViewer ready={ready} unavailable={initializing || busy || Boolean(pending)}
            onSignIn={beginLoginRedirect}
            onWorkingChange={working => { busyRef.current = working; setBusy(working); }}
            readGovernedStatus={() => run('browser.remote.status', browserTarget,
              () => ({ action: 'browser.remote.status', arguments: {} }), 'ตรวจเซสชันร่วมของ Viewer และ Agent')} />
          {catalogLoaded && !isAvailable('browser.remote.status', browserTarget) && <p className="text-amber-200">runtime ยังไม่เปิดเส้นทาง Browser — ตรวจ deployment ก่อนเชื่อม</p>}
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await run('browser.remote.status', browserTarget, () => ({ action: 'browser.remote.status', arguments: {} }), 'อ่านสถานะ Browser'); })}>ตรวจสถานะ Browser</button>
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(browserConnect)}>ขอเชื่อม Browser</button>
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await browserVerifier('browser.extract'); })}>Agent Verifier · อ่านหน้าเว็บ</button>
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await browserVerifier('browser.screenshot'); })}>Agent Verifier · ภาพหน้าจอ</button>
            <a href="https://aws.dsg.pics/app" target="_blank" rel="noopener noreferrer" className={button}>Evidence &amp; Conformance ↗ (ไม่ใช่ Cinema Viewer)</a>
          </div>
          <label htmlFor="workroom-browser-url" className="block text-sm font-semibold">เว็บที่จะเปิด</label>
          <input id="workroom-browser-url" type="url" value={url} onChange={event => setUrl(event.target.value)} className={field} />
          <button className={button} disabled={busy || !ready || Boolean(pending) || !url.trim()} onClick={() => void act(browserNavigate)}>ขอเชื่อม เปิดเว็บ และอ่านผล</button>
        </>}
        {tab === 'desktop' && <>
          <p className="text-sm text-slate-300">สั่งงานบนอุปกรณ์ DSG Native ที่ระบบเชื่อมไว้ ชื่อเครื่องและความพร้อมจะแสดงจากผลตรวจจริง</p>
          {nativeDevice ? <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
            <p className="font-semibold text-white">อุปกรณ์ที่ตรวจได้: {nativeDevice.label}</p>
            <p className="mt-1 text-slate-300">{nativeDevice.online === true ? 'ออนไลน์จากการตรวจล่าสุด' : nativeDevice.online === false ? 'ออฟไลน์จากการตรวจล่าสุด' : 'ยังไม่ยืนยันสถานะออนไลน์'}</p>
            <details className="mt-2 text-slate-400"><summary className="cursor-pointer py-2">รายละเอียดอุปกรณ์</summary>
              <p className="break-all">{nativeDevice.deviceId}</p>{nativeDevice.platform && <p className="break-all">{nativeDevice.platform}</p>}
            </details>
          </div> : <p className="text-sm text-slate-400">ยังไม่มีผลตรวจอุปกรณ์ในหน้านี้ · ใช้ปุ่มตรวจอุปกรณ์เพื่อดูข้อมูลล่าสุด</p>}
          {catalogLoaded && !isAvailable('device.remote.status', desktopTarget) && <p className="text-amber-200">DSG Desktop Native ยังไม่ได้ enroll กับ runtime — จับคู่เครื่องก่อนใช้งาน</p>}
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await run('device.remote.status', desktopTarget, () => ({ action: 'device.remote.status', arguments: {} }), 'ตรวจ Remote Desktop'); })}>ตรวจอุปกรณ์ที่เชื่อมต่อ</button>
            <button className={button} disabled={busy || !ready || Boolean(pending)} onClick={() => void act(async () => { await run('device.process.list', desktopTarget, () => ({ action: 'device.process.list', arguments: {} }), 'อ่านรายการ process'); })}>ดูโปรแกรมที่กำลังทำงาน</button>
            <a href="/control/" target="_blank" rel="noreferrer" className={button}>จัดการอุปกรณ์ ↗</a>
          </div>
          <label htmlFor="workroom-file-path" className="block text-sm font-semibold">ไฟล์ที่จะอ่าน</label>
          <input id="workroom-file-path" value={path} onChange={event => setPath(event.target.value)} className={field} placeholder="พาธในอุปกรณ์ที่ผูกไว้" />
          <button className={button} disabled={busy || !ready || Boolean(pending) || !path.trim()} onClick={() => void act(async () => { await run('device.fs.read', desktopTarget, () => ({ action: 'device.fs.read', arguments: { path: path.trim(), length: 100 } }), 'อ่านไฟล์จาก Desktop'); })}>อ่านไฟล์</button>
          <label htmlFor="workroom-shell-command" className="block text-sm font-semibold">สั่งให้ DSG Native ทำอะไร (Shell Command)</label>
          <textarea id="workroom-shell-command" rows={2} value={command} onChange={event => setCommand(event.target.value)} className={field} placeholder="เช่น pwd หรือ ls -la" />
          <button className={button} disabled={busy || !ready || Boolean(pending) || !command.trim()} onClick={() => void act(async () => { await run('device.shell.exec', desktopTarget, () => ({ action: 'device.shell.exec', arguments: { command: command.trim(), wait_seconds: 3 } }), 'ทำคำสั่งบน DSG Native'); })}>เริ่มงาน · อนุมัติเมื่อจำเป็น</button>
          {shellProcessId && (
            <div className="rounded-xl border border-indigo-400/30 p-3 text-sm">
              <p>สถานะคำสั่ง: {shellOutcome === 'running' ? 'กำลังทำงาน' : 'รอตรวจผล'}</p>
              <button className={`${button} mt-2`} disabled={busy || !ready || Boolean(pending)}
                onClick={() => void act(checkShellProcess)}>ตรวจผลคำสั่งเดิม (ไม่รันซ้ำ)</button>
            </div>
          )}
        </>}
      </div>
      {pending && <section className="mt-5 rounded-xl border border-amber-400/50 p-4" aria-label="งานรออนุมัติ">
        <h3 className="font-bold text-amber-100">รอเจ้าของอนุมัติคำขอที่แสดง</h3>
        <p className="mt-2 text-sm text-slate-300">ตรวจคำขอด้านล่างแล้วอนุมัติตามขอบเขต จากนั้นกลับมาแท็บนี้ ระบบจะตรวจคำขอเดิมและทำขั้นตอนต่อเรียงตามแผนเมื่อเซสชันยังอยู่ (ภายใน 10 นาที)</p>
        <details className="mt-3 rounded-lg border border-slate-700 p-3"><summary className="cursor-pointer text-sm">รายละเอียดเทคนิคของคำขอ</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(publicWorkroomReceipt(pending.steps.map(step => ({
          label: step.label,
          approval_request_id: step.approvalRequestId,
          route_id: step.request.route_id,
          payload: step.request.payload,
        }))), null, 2)}</pre></details>
        <div className="mt-3 flex flex-wrap gap-2">
          {pending.steps.filter(step => step.approvalRequestId).map((step, index) => (
            <a key={step.approvalRequestId} href={approvalHref(step.approvalRequestId)}
              target="_blank" rel="noreferrer" className={`${button} bg-indigo-700`}>อนุมัติงาน {index + 1} ↗</a>
          ))}
          <button className={button} disabled={busy || !ready} onClick={() => void act(resume)}>ตรวจการอนุมัติและทำงานต่อ</button>
          <button className={button} disabled={busy} onClick={() => { setPending(null); setStatus('หยุดรอในหน้านี้ คำขอที่ยังไม่อนุมัติจะหมดอายุเอง'); }}>หยุดรอ</button>
        </div>
      </section>}
      {receipt != null && <section className="mt-5 rounded-xl border border-emerald-600/50 p-4" aria-label="ผลการทำงานที่ตรวจหลักฐานแล้ว"><h3 className="font-bold text-emerald-200">ผลขั้นตอน · {verifiedAction || 'งานล่าสุด'} — ตรวจหลักฐานของขั้นตอนนี้แล้ว</h3>
        {observedPage && <p className="mt-2 break-words text-sm text-slate-200">หน้าเว็บที่ Verifier อ่านจริง: {observedPage.title || observedPage.url}<br /><span className="text-slate-400">{observedPage.url}</span></p>}
        <details className="mt-3">
        <summary className="cursor-pointer font-semibold">ดูผล Provider และ Evidence (ขั้นสูง)</summary>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-300">{JSON.stringify(receipt, null, 2)}</pre>
      </details></section>}
    </section>
  );
}

