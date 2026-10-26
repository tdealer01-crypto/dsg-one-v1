'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRDViewer } from './PRDViewer';
import { useAppBuilderGoalBridge } from './AppBuilderGoalBridge';
import { PlanObserverPanel } from './PlanObserverPanel';
import { HandoffPanel } from './HandoffPanel';
import { RuntimeGatePanel } from './RuntimeGatePanel';
import { GovernedToolPanel, collectPersistedRecords } from '@/components/dsg/governed-tools/GovernedToolPanels';
import type { DsgAppBuilderPrd } from '@/lib/dsg/app-builder/types/prd';
import type { AppBuilderJob } from '@/lib/dsg/app-builder/model';
import type { DsgOutcomeIntake } from '@/lib/dsg/app-builder/outcome-intake';
import type { DsgAppTemplate } from '@/lib/dsg/app-builder/templates/template-registry';
import type { DsgPlanDraft, DsgPlanObserverResult } from '@/lib/dsg/app-builder/plan/types';
import type { DsgAppBuilderApprovalGate, DsgRuntimeHandoffDraft } from '@/lib/dsg/app-builder/approval/types';
import type { RuntimeExecutionGateResult } from '@/lib/dsg/app-builder/runtime/types';
import type { DsgGovernedToolAction, DsgGovernedToolExecutionResult, DsgGovernedToolKind, DsgGovernedToolPreparedRequest } from '@/lib/dsg/tools/governed-tools';

type PrdResponse = {
  ok: boolean;
  prd?: DsgAppBuilderPrd;
  selectedTemplate?: DsgAppTemplate;
  templateCandidates?: DsgAppTemplate[];
  boundary?: { claimStatus: string; productionReadyClaim: boolean; modelUsed?: boolean; note?: string };
  error?: { code: string; message: string };
};

type PlanResponse = {
  ok: boolean;
  plan?: DsgPlanDraft;
  observer?: DsgPlanObserverResult;
  boundary?: { claimStatus: string; productionReadyClaim: boolean; runtimeExecutionReady: boolean; z3RuntimeProof?: boolean };
  error?: { code: string; message: string };
};

type HandoffResponse = {
  ok: boolean;
  approvalGate?: DsgAppBuilderApprovalGate;
  handoff?: DsgRuntimeHandoffDraft;
  error?: { code: string; message: string };
};

type RuntimeGateResponse = RuntimeExecutionGateResult | { ok: false; error: { code: string; message: string } };

type JobResponse = {
  ok: boolean;
  data?: { id?: string; status?: string; claimStatus?: string };
  error?: { code: string; message: string };
};

type AgentLoopResponse = {
  ok?: boolean;
  error?: { code: string; message: string };
  jobId?: string;
  phase?: string;
  risk?: { risk: string; state: string; reasons: string[] };
  benefit?: { ok: boolean; userBenefit: string; easier: boolean; tangibleOutput: string; nextAction: string; missing: string[] };
  truthBoundary?: { ok: boolean; blockedReasons: string[]; productionReadyClaim: false; note: string };
  contextPack?: { id: string; contextHash: string; gateStatus: string; gateReasons: string[]; contextText: string } | null;
  memories?: Array<{ id: string; kind: string; trust: string; status: string; summary: string }>;
  nextActions?: string[];
  verifiedInput?: { status: string; hash: string; evidence: string[] };
  productionReadyClaim?: false;
};

type PreviewMode = 'concept' | 'live' | 'monitor' | 'brain' | 'tools';


// The verified identity and workspace are resolved server-side from the
// authenticated session and membership; browser headers never assert a role.
const dsgHeaders = { 'content-type': 'application/json' };

const starterApps = [
  {
    label: 'เกม ABC เด็ก 3 ขวบ',
    goal: 'สร้างเกม ABC สำหรับเด็ก 3 ขวบ มีรูปภาพ A B C ปุ่มใหญ่ แตะง่าย มีคะแนน เล่นใหม่ได้ และบันทึกคะแนนลงฐานข้อมูล',
    criteria: ['เด็กแตะ A/B/C ได้ง่ายบนมือถือ', 'มี feedback ถูก/ผิดทันที', 'บันทึกคะแนนลงฐานข้อมูล', 'เปิดหน้า deploy แล้วเล่นได้จริง'],
  },
  {
    label: 'ระบบจองคิวร้าน',
    goal: 'สร้างแอปจองคิวสำหรับร้านเล็ก ลูกค้าเลือกวันเวลา เจ้าของร้านเห็นรายการจอง และบันทึกลงฐานข้อมูล',
    criteria: ['ลูกค้าจองคิวได้', 'เจ้าของร้านเห็นคิวล่าสุด', 'ข้อมูลอยู่ในฐานข้อมูล', 'มีสถานะยืนยันหรือรอตรวจ'],
  },
  {
    label: 'CRM ทีมเล็ก',
    goal: 'สร้าง CRM ง่ายๆ สำหรับทีมเล็ก มีรายชื่อลูกค้า งานที่ต้องติดตาม โน้ต และสถานะดีล',
    criteria: ['เพิ่มลูกค้าได้', 'เพิ่มงานติดตามได้', 'กรองสถานะได้', 'มีหลักฐานการบันทึกข้อมูล'],
  },
  {
    label: 'แดชบอร์ดรายรับ',
    goal: 'สร้างแดชบอร์ดรายรับแบบง่าย กรอกยอดขายรายวัน ดูยอดรวม และเห็นรายการย้อนหลังสำหรับเจ้าของร้าน',
    criteria: ['เพิ่มยอดขายรายวันได้', 'เห็นยอดรวม', 'เห็นรายการย้อนหลัง', 'มี proof ว่า backend/database ใช้งานได้'],
  },
];

function statusTone(status: string) {
  if (status.includes('BLOCK') || status.includes('FAILED') || status.includes('REQUIRED')) return 'border-rose-400/40 bg-rose-500/10 text-rose-100';
  if (status.includes('JOB_CREATED') || status.includes('PRD') || status.includes('PLAN') || status.includes('APPROVED') || status.includes('PASS')) return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
  return 'border-amber-400/40 bg-amber-500/10 text-amber-100';
}

function stateTone(state: string) {
  const normalized = state.toLowerCase();
  if (normalized.includes('block') || normalized.includes('required') || normalized.includes('not_configured')) return 'border-rose-400/40 bg-rose-500/10 text-rose-100';
  if (normalized.includes('review')) return 'border-amber-400/40 bg-amber-500/10 text-amber-100';
  if (normalized.includes('ready') || normalized.includes('approved') || normalized.includes('created') || normalized.includes('pass') || normalized.includes('runtime_evidence')) return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
  return 'border-slate-700 bg-slate-950 text-slate-300';
}

function extractCreatedJobId(url: string | null) {
  if (!url) return 'ui-agent-loop';
  return url.split('/').filter(Boolean).at(-1) || 'ui-agent-loop';
}

// Codes the Workspace Jobs panel is allowed to print. Anything else is replaced by a generic label, so no raw
// upstream or exception text can reach the screen. Kept in sync with lib/dsg/server/app-builder/job-error.ts by a test.
const JOBS_PANEL_CODES = new Set<string>([
  'APP_BUILDER_DB_URL_NOT_CONFIGURED',
  'APP_BUILDER_DB_SERVICE_ROLE_NOT_CONFIGURED',
  'APP_BUILDER_DB_SERVICE_ROLE_INVALID',
  'APP_BUILDER_DB_CONNECT_FAILED',
  'APP_BUILDER_DB_ACCESS_DENIED',
  'APP_BUILDER_DB_SCHEMA_OR_ROUTE_NOT_FOUND',
  'APP_BUILDER_DB_UPSTREAM_UNAVAILABLE',
  'APP_BUILDER_DB_REQUEST_REJECTED',
  'APP_BUILDER_DB_RESPONSE_INVALID',
  'APP_BUILDER_AUTH_BACKEND_UNAVAILABLE',
  'JOBS_API_UNREACHABLE',
  'LOGIN_REQUIRED_TO_LOAD_REAL_JOBS',
  'WORKSPACE_ACCESS_DENIED',
]);

export function AppBuilderConsoleClient({ initialGoal = '', initialCriteria = '', acceptedIntake }: { initialGoal?: string; initialCriteria?: string; acceptedIntake?: DsgOutcomeIntake }) {
  const [goal, setGoal] = useState(initialGoal);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [prd, setPrd] = useState<DsgAppBuilderPrd | null>(null);
  const [plan, setPlan] = useState<DsgPlanDraft | null>(null);
  const [observer, setObserver] = useState<DsgPlanObserverResult | null>(null);
  const [approvalGate, setApprovalGate] = useState<DsgAppBuilderApprovalGate | null>(null);
  const [handoff, setHandoff] = useState<DsgRuntimeHandoffDraft | null>(null);
  const [runtimeGate, setRuntimeGate] = useState<RuntimeExecutionGateResult | null>(null);
  const [agentLoop, setAgentLoop] = useState<AgentLoopResponse | null>(null);
  const [templateName, setTemplateName] = useState('Initial product console');
  const [status, setStatus] = useState('Ready. Pick an example or describe an app, then create a governed job.');
  const [createdJobUrl, setCreatedJobUrl] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<AppBuilderJob[]>([]);
  const [jobsReadState, setJobsReadState] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [jobsReadMessage, setJobsReadMessage] = useState('กำลังตรวจงานจากฐานข้อมูลจริง…');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('concept');
  const [loadingAgentLoop, setLoadingAgentLoop] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [loadingPrd, setLoadingPrd] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingHandoff, setLoadingHandoff] = useState(false);
  const [loadingRuntimeGate, setLoadingRuntimeGate] = useState(false);
  const [toolKind, setToolKind] = useState<DsgGovernedToolKind>('plan');
  const [toolAction, setToolAction] = useState<DsgGovernedToolAction>('dry_run');
  const [toolArgsText, setToolArgsText] = useState('{\n  "title": "Console dry-run plan",\n  "payload": { "source": "app-builder-console" }\n}');
  const [toolAllowedHosts, setToolAllowedHosts] = useState('');
  const [governedPrepared, setGovernedPrepared] = useState<DsgGovernedToolPreparedRequest | null>(null);
  const [governedResult, setGovernedResult] = useState<DsgGovernedToolExecutionResult | null>(null);
  const [loadingGovernedTool, setLoadingGovernedTool] = useState(false);

  const criteriaList = useMemo(() => criteria.split('\n').map((line) => line.trim()).filter(Boolean), [criteria]);

  // The owner-scoped server route reads persisted Supabase jobs. Never synthesize
  // a saved job from a sample, localStorage or a guessed generated-app route.
  const refreshSavedJobs = useCallback(async (signal?: AbortSignal) => {
    setJobsReadState('loading');
    setJobsReadMessage('กำลังอ่านงานที่บันทึกจริง…');
    try {
      const response = await fetch('/api/dsg/app-builder/jobs', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
      });
      // A proxy error page (HTML 502/504) is not JSON: treat it as "API unreachable", never show a parse error.
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok || !json || typeof json !== 'object' || !('ok' in json) || json.ok !== true ||
          !('data' in json) || !Array.isArray(json.data)) {
        const failure = json && typeof json === 'object' && 'error' in json && json.error && typeof json.error === 'object' && 'code' in json.error
          ? json.error.code : json === null ? 'JOBS_API_UNREACHABLE' : null;
        const safeCode = typeof failure === 'string' && JOBS_PANEL_CODES.has(failure) ? failure : 'JOB_DATABASE_UNAVAILABLE';
        throw new Error(response.status === 401 ? 'LOGIN_REQUIRED_TO_LOAD_REAL_JOBS'
          : response.status === 403 ? 'WORKSPACE_ACCESS_DENIED'
          : safeCode);
      }
      if (signal?.aborted) return;
      const jobs = json.data.filter((entry: unknown): entry is AppBuilderJob => {
        return typeof entry === 'object' && entry !== null && 'id' in entry &&
          typeof entry.id === 'string' && /^[0-9a-f-]{36}$/i.test(entry.id) &&
          'status' in entry && typeof entry.status === 'string' &&
          'claimStatus' in entry && typeof entry.claimStatus === 'string';
      });
      setSavedJobs(jobs);
      setJobsReadState('ready');
      setJobsReadMessage(jobs.length ? `โหลดงานจริง ${jobs.length} รายการ` : 'ยังไม่มีงานที่บันทึกใน Workspace นี้');
    } catch (error) {
      if (signal?.aborted) return;
      setSavedJobs([]);
      setJobsReadState('blocked');
      // Only the codes produced above are shown. A network failure (fetch rejects) says so; any other exception
      // text (for example a JavaScript parse error) is never printed as if it were a server code.
      const shown = error instanceof Error ? error.message : '';
      setJobsReadMessage(JOBS_PANEL_CODES.has(shown) ? shown : error instanceof TypeError ? 'JOBS_API_UNREACHABLE' : 'JOB_DATABASE_UNAVAILABLE');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Schedule after the effect callback returns to avoid synchronous
    // setState during effect execution; AbortController handles unmount.
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return refreshSavedJobs(controller.signal);
      return undefined;
    });
    return () => controller.abort();
  }, [refreshSavedJobs]);

  function invalidateDerivedState() {
    // A newly typed goal or criteria invalidates ALL artifacts from old input.
    setPrd(null);
    setPlan(null);
    setObserver(null);
    setApprovalGate(null);
    setHandoff(null);
    setRuntimeGate(null);
    setAgentLoop(null);
    setGovernedPrepared(null);
    setGovernedResult(null);
    setCreatedJobUrl(null);
    setPreviewMode('concept');
    setStatus('INPUT_CHANGED · generate a PRD and governed job for this exact goal');
  }

  function updateGoal(next: string) {
    setGoal(next);
    invalidateDerivedState();
  }

  function updateCriteria(next: string) {
    setCriteria(next);
    invalidateDerivedState();
  }
  const timeline = useMemo(() => [
    { label: 'Goal', state: goal.trim() ? 'ready' : 'BLOCKED', detail: goal.trim() ? 'User command captured' : 'Goal required' },
    { label: 'Brain loop', state: agentLoop ? (agentLoop.ok ? 'PASS' : 'BLOCK_OR_REVIEW') : 'waiting', detail: agentLoop?.contextPack ? `Memory context ${agentLoop.contextPack.gateStatus}` : 'Run Brain Loop before execution' },
    { label: 'PRD', state: prd ? 'ready' : 'waiting', detail: prd?.title || 'Generate PRD' },
    { label: 'Plan', state: plan ? 'ready' : 'waiting', detail: plan ? 'Plan observer available' : 'Run Plan + Observer' },
    { label: 'Handoff', state: handoff ? handoff.status : 'waiting', detail: handoff ? 'Approval handoff created' : 'Approval required' },
    { label: 'Runtime gate', state: runtimeGate ? runtimeGate.status : 'waiting', detail: runtimeGate ? runtimeGate.status : 'Not executed' },
    { label: 'Governed tool', state: governedResult?.outputVerification || governedPrepared?.status || 'waiting', detail: governedPrepared ? `${governedPrepared.tool}.${governedPrepared.action} · ${governedPrepared.audit.truth}` : 'Prepare or execute from Tools panel' },
  ], [goal, prd, plan, handoff, runtimeGate, agentLoop, governedPrepared, governedResult]);

  const nextAction = !goal.trim()
    ? 'กรอกเป้าหมายของแอปก่อน — ยังไม่มี PRD หรือ Job'
    : !createdJobUrl
      ? 'กดบันทึกงานจากเป้าหมายนี้ เพื่อเก็บงานในพื้นที่ทำงาน'
      : !prd
        ? 'กดสร้างรายละเอียดแอป แล้วตรวจเนื้อหาจากเป้าหมายที่บันทึก'
        : !plan
          ? 'กดสร้างและตรวจแผนจากรายละเอียดแอปปัจจุบัน'
          : !handoff
            ? 'กดตรวจเงื่อนไขการส่งต่องาน ก่อนใช้ Runtime'
            : runtimeGate
              ? 'ตรวจผล Runtime Gate และ Evidence ใน Job Timeline; ห้ามอ้างว่า Deploy แล้วหากยังไม่มี Proof'
              : 'กดตรวจความพร้อม Runtime แล้วเปิดผลของงาน; ขั้นนี้ยังไม่ได้สั่ง Execute';

  function applyStarter(app: (typeof starterApps)[number]) {
    setGoal(app.goal);
    setCriteria(app.criteria.join('\n'));
    invalidateDerivedState();
    setStatus(`Loaded example: ${app.label}. Review the goal, then run Brain Loop or create a governed job.`);
  }

  async function runAgentLoop(phase = 'planning') {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setStatus('APP_BUILDER_GOAL_REQUIRED');
      return;
    }

    setLoadingAgentLoop(true);
    setStatus('Running memory-backed DSG Brain Loop…');
    try {
      const response = await fetch('/api/dsg/app-builder/agent-loop', {
        method: 'POST',
        headers: dsgHeaders,
        body: JSON.stringify({
          jobId: extractCreatedJobId(createdJobUrl),
          phase,
          goal: trimmedGoal,
          successCriteria: criteriaList,
          history: timeline.map((item) => `${item.label}:${item.state}`),
        }),
      });
      const json = (await response.json()) as AgentLoopResponse;
      if (!response.ok || json.error) throw new Error(json.error?.message || 'APP_BUILDER_AGENT_LOOP_FAILED');
      setAgentLoop(json);
      setPreviewMode('brain');
      setStatus(`${json.ok ? 'AGENT_LOOP_PASS' : 'AGENT_LOOP_REVIEW'} · memory=${json.memories?.length || 0} · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_AGENT_LOOP_FAILED');
    } finally {
      setLoadingAgentLoop(false);
    }
  }

  async function createGovernedJob() {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setStatus('APP_BUILDER_GOAL_REQUIRED');
      return;
    }

    if (acceptedIntake && trimmedGoal !== acceptedIntake.goal) {
      setStatus('OUTCOME_INPUT_CHANGED_REVALIDATION_REQUIRED · submit the edited goal through Outcome Intake before creating a job');
      return;
    }
    const requiresAuth = Boolean(
      acceptedIntake?.productionIntent ||
      (acceptedIntake && acceptedIntake.riskLevel !== 'low') ||
      acceptedIntake?.requiredIntegrations.some(value => /auth|login|sso|oauth|rbac|identity/i.test(value)) ||
      /auth|login|crm|membership|member|workspace role/i.test(trimmedGoal),
    );
    const constraints = [
      'no production-ready claim without build/deploy/evidence proof',
      'no mock data presented as production evidence',
      'show a user-visible next action when blocked',
      ...(acceptedIntake ? [
        `Verified outcome risk level: ${acceptedIntake.riskLevel}`,
        `Production intent: ${acceptedIntake.productionIntent}; do not claim production readiness without signed proof`,
        `Target users: ${acceptedIntake.targetUsers.join(', ') || 'not specified'}`,
        `Available data: ${acceptedIntake.availableData.join(', ') || 'not specified'}`,
        `Required integrations: ${acceptedIntake.requiredIntegrations.join(', ') || 'none specified'}`,
        `Accepted success outcome: ${acceptedIntake.successOutcome || 'not specified'}`,
        ...(requiresAuth ? ['Require governed authentication and RBAC design; never silently substitute auth:none for accepted SSO or owner controls'] : []),
      ] : []),
    ];
    setLoadingJob(true);
    setCreatedJobUrl(null);
    setStatus('Creating governed App Builder job…');
    try {
      const response = await fetch('/api/dsg/app-builder/jobs', {
        method: 'POST',
        headers: dsgHeaders,
        body: JSON.stringify({
          goal: trimmedGoal,
          successCriteria: criteriaList,
          targetStack: { frontend: 'nextjs', backend: 'next-api', database: 'supabase-postgres', auth: requiresAuth ? 'custom' : 'none', deploy: 'none' },
          constraints,
          userNotes: 'Self-service builder job. App-builder UX reference: command, live preview, monitor, and evidence panel in one workspace.',
        }),
      });
      const json = (await response.json()) as JobResponse;
      if (!response.ok || !json.ok || !json.data?.id) throw new Error(json.error?.message || 'APP_BUILDER_JOB_CREATE_FAILED');
      const url = `/dsg/app-builder/${json.data.id}`;
      setCreatedJobUrl(url);
      await refreshSavedJobs();
      setStatus(`${json.data.status || 'JOB_CREATED'} · claim=${json.data.claimStatus || 'PLANNED_ONLY'} · next=open job timeline`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_JOB_CREATE_FAILED');
    } finally {
      setLoadingJob(false);
    }
  }

  async function generatePrd() {
    setLoadingPrd(true);
    setStatus('Generating deterministic PRD draft…');
    try {
      const response = await fetch('/api/dsg/app-builder/prd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goal }) });
      const json = (await response.json()) as PrdResponse;
      if (!response.ok || !json.ok || !json.prd) throw new Error(json.error?.message || 'APP_BUILDER_PRD_FAILED');
      setPrd(json.prd);
      setPlan(null);
      setObserver(null);
      setApprovalGate(null);
      setHandoff(null);
      setRuntimeGate(null);
      setTemplateName(json.selectedTemplate?.name || 'Template selected');
      setStatus(`${json.boundary?.claimStatus || 'PRD_DRAFT_ONLY'} · modelUsed=${json.boundary?.modelUsed ? 'true' : 'false'} · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_PRD_FAILED');
    } finally {
      setLoadingPrd(false);
    }
  }

  async function generatePlan() {
    if (!prd) {
      setStatus('PRD_REQUIRED_FOR_THIS_GOAL · generate PRD before plan');
      return;
    }
    setLoadingPlan(true);
    setStatus('Deriving plan draft and running observer…');
    try {
      const response = await fetch('/api/dsg/app-builder/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prd }) });
      const json = (await response.json()) as PlanResponse;
      if (!response.ok || !json.ok || !json.plan || !json.observer) throw new Error(json.error?.message || 'APP_BUILDER_PLAN_FAILED');
      setPlan(json.plan);
      setObserver(json.observer);
      setApprovalGate(null);
      setHandoff(null);
      setRuntimeGate(null);
      setStatus(`${json.boundary?.claimStatus || 'PLAN_DRAFT_ONLY'} · observer=${json.observer.status} · z3RuntimeProof=${json.boundary?.z3RuntimeProof ? 'true' : 'false'} · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_PLAN_FAILED');
    } finally {
      setLoadingPlan(false);
    }
  }

  async function createHandoff() {
    if (!plan || !observer) {
      setStatus('APP_BUILDER_PLAN_OBSERVER_REQUIRED');
      return;
    }
    setLoadingHandoff(true);
    setStatus('Evaluating approval gate and creating runtime handoff draft…');
    try {
      const response = await fetch('/api/dsg/app-builder/handoff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, observer }) });
      const json = (await response.json()) as HandoffResponse;
      if (!response.ok || !json.ok || !json.approvalGate || !json.handoff) throw new Error(json.error?.message || 'APP_BUILDER_HANDOFF_FAILED');
      setApprovalGate(json.approvalGate);
      setHandoff(json.handoff);
      setRuntimeGate(null);
      setStatus(`${json.handoff.status} · runtimeExecutionStarted=false · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'APP_BUILDER_HANDOFF_FAILED');
    } finally {
      setLoadingHandoff(false);
    }
  }


  function parseToolArgs() {
    const parsed = JSON.parse(toolArgsText || '{}') as Record<string, unknown>;
    const allowedHosts = toolAllowedHosts.split('\n').map((host) => host.trim()).filter(Boolean);
    return {
      ...parsed,
      ...(allowedHosts.length ? { allowedHosts } : {}),
    };
  }

  async function runGovernedTool() {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setStatus('APP_BUILDER_GOAL_REQUIRED');
      return;
    }

    setLoadingGovernedTool(true);
    setStatus(`Inspecting governed ${toolKind}.${toolAction} (no provider execution)…`);
    try {
      const response = await fetch('/api/dsg/tools', {
        method: 'POST',
        headers: dsgHeaders,
        body: JSON.stringify({
          tool: toolKind,
          action: toolAction,
          goal: trimmedGoal,
          args: parseToolArgs(),
          evidence: ['ui:app-builder-console', plan?.jobId ? `plan:${plan.jobId}` : 'plan:not-generated'],
          history: timeline.map((item) => `${item.label}:${item.state}`),
          execute: false,
        }),
      });
      const json = (await response.json()) as DsgGovernedToolPreparedRequest | DsgGovernedToolExecutionResult | { ok: false; error?: { message?: string; code?: string } };
      if ('prepared' in json) {
        setGovernedResult(json);
        setGovernedPrepared(json.prepared);
        setStatus(`${json.ok ? 'GOVERNED_TOOL_EXECUTED' : 'GOVERNED_TOOL_BLOCKED'} · ${json.outputVerification} · records=${collectPersistedRecords(json).length}`);
      } else if ('tool' in json) {
        setGovernedResult(null);
        setGovernedPrepared(json);
        setStatus(`${json.ok ? 'GOVERNED_TOOL_READY' : 'GOVERNED_TOOL_REVIEW_OR_BLOCKED'} · ${json.status} · reasons=${json.blockedReasons.length}`);
      } else {
        throw new Error(json.error?.message || json.error?.code || 'GOVERNED_TOOL_REQUEST_FAILED');
      }
      setPreviewMode('tools');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'GOVERNED_TOOL_REQUEST_FAILED');
    } finally {
      setLoadingGovernedTool(false);
    }
  }

  async function startRuntimeGate() {
    if (!handoff || !plan) {
      setStatus('RUNTIME_HANDOFF_REQUIRED');
      return;
    }
    setLoadingRuntimeGate(true);
    setStatus('Evaluating fail-closed runtime execution gate…');
    try {
      const requiredSecrets = Array.from(new Set(plan.actions.flatMap((action) => action.requiredSecrets)));
      const response = await fetch('/api/dsg/app-builder/runtime/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handoff,
          approval: { status: approvalGate?.approved ? 'APPROVED' : approvalGate?.status || 'BLOCKED', signatureValid: approvalGate?.approved === true },
          secrets: { exists: false, expired: true, requiredSecrets, availableSecrets: [] },
          executorPool: { available: 0, health: 'NOT_CONFIGURED', mode: 'vercel-serverless-gate-only' },
          proofBundle: { requiredFields: ['audit_export', 'evidence_manifest', 'deployment_proof', 'auth_rbac_proof'], presentFields: [], hashChainValid: false },
        }),
      });
      const json = (await response.json()) as RuntimeGateResponse;
      if (!response.ok || !json.ok) throw new Error('error' in json ? json.error.message : 'RUNTIME_EXECUTION_GATE_FAILED');
      setRuntimeGate(json);
      setStatus(`${json.status} · runtimeExecutionStarted=false · productionReadyClaim=false`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'RUNTIME_EXECUTION_GATE_FAILED');
    } finally {
      setLoadingRuntimeGate(false);
    }
  }

  return (
    <div id="dsg-app-builder-console" className="grid scroll-mt-4 gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-8">

        <section aria-label="Real saved app builder jobs" className="rounded-2xl border border-cyan-400/25 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-white">งานที่บันทึกจริง (Workspace Jobs)</h2>
              <p role="status" className="mt-1 text-xs text-slate-400">{jobsReadMessage}</p>
            </div>
            <button type="button" onClick={() => void refreshSavedJobs()} disabled={jobsReadState === 'loading'}
              className="min-h-11 rounded-xl border border-cyan-300/40 px-4 py-2 text-sm text-cyan-100 disabled:opacity-50">
              {jobsReadState === 'loading' ? 'กำลังโหลด…' : 'รีเฟรชสถานะจริง'}
            </button>
          </div>
          {jobsReadState === 'blocked' ? <p className="mt-3 text-xs text-rose-300">BLOCKED · ไม่มีการแทนที่ข้อมูลจากฐานข้อมูลด้วยตัวอย่าง</p> : null}
          {jobsReadState === 'ready' && savedJobs.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {savedJobs.slice(0, 8).map((job) => (
                <li key={job.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                  <a className="block break-words font-semibold text-cyan-200 underline-offset-2 hover:underline"
                    href={`/dsg/app-builder/${job.id}`}>{job.goal?.originalGoal || job.id}</a>
                  <p className="mt-1 text-xs text-slate-400">Job: {job.status} · Claim: {job.claimStatus} · Updated: {job.updatedAt}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Self-service App Builder</p>
              <h2 className="mt-2 text-2xl font-black text-slate-100">ไม่ต้องรอคนมาทำให้ — สั่งงานและดูพรีวิวข้างๆ</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">เลือกตัวอย่างหรือพิมพ์แอปที่ต้องการ แล้วดู PRD, plan, monitor, preview และ evidence ใน workspace เดียว.</p>
            </div>
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">EVIDENCE_FIRST</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {starterApps.map((app) => (
              <button key={app.label} onClick={() => applyStarter(app)} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left hover:border-indigo-400/50 hover:bg-indigo-500/10">
                <p className="font-black text-slate-100">{app.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{app.goal}</p>
              </button>
            ))}
          </div>

          <label htmlFor="builder-goal" className="mt-5 block text-sm font-medium text-slate-200">เป้าหมายของแอป</label>
          <textarea id="builder-goal" value={goal} onChange={(event) => updateGoal(event.target.value)} className="mt-2 min-h-32 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-indigo-500" placeholder="Describe the app you want DSG to build…" />
          <label htmlFor="builder-criteria" className="mt-4 block text-sm font-medium text-slate-200">ผลลัพธ์ที่ใช้ตรวจงาน</label>
          <textarea id="builder-criteria" value={criteria} onChange={(event) => updateCriteria(event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-indigo-500" placeholder="Success criteria, one per line…" />

          <div className="dsg-action-row">
            {runtimeGate && createdJobUrl ? <a href={createdJobUrl} className="dsg-button-primary">ดูผลและหลักฐานของงาน</a> :
              <button type="button" className="dsg-button-primary" disabled={!goal.trim() || loadingJob || loadingPrd || loadingPlan || loadingHandoff || loadingRuntimeGate || (!!plan && !handoff && !observer)}
                onClick={() => { if (!createdJobUrl) void createGovernedJob(); else if (!prd) void generatePrd(); else if (!plan) void generatePlan(); else if (!handoff) void createHandoff(); else void startRuntimeGate(); }}>
                {loadingJob || loadingPrd || loadingPlan || loadingHandoff || loadingRuntimeGate ? 'กำลังดำเนินการ…' : !createdJobUrl ? 'บันทึกงานจากเป้าหมายนี้' : !prd ? 'สร้างรายละเอียดแอป' : !plan ? 'สร้างและตรวจแผน' : !handoff ? 'ตรวจเงื่อนไขการส่งต่องาน' : 'ตรวจความพร้อม Runtime'}
              </button>}
          </div>
          <details className="mt-4 rounded-xl border border-slate-700 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">ควบคุมแต่ละขั้น · Brain Loop และเครื่องมือเพิ่มเติม</summary>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap">
            <button onClick={() => void runAgentLoop('planning')} disabled={loadingAgentLoop} className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">{loadingAgentLoop ? 'Thinking…' : 'Run Brain Loop'}</button>
            <button onClick={() => void createGovernedJob()} disabled={loadingJob} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">{loadingJob ? 'Creating job…' : 'Create governed job'}</button>
            <button onClick={() => void generatePrd()} disabled={loadingPrd} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">{loadingPrd ? 'Generating…' : 'Generate PRD'}</button>
            <button onClick={() => void generatePlan()} disabled={loadingPlan || !prd} className="rounded-2xl border border-violet-400/40 bg-violet-500/10 px-5 py-3 text-sm font-black text-violet-100 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60">{loadingPlan ? 'Observing…' : 'Plan + Observer'}</button>
            <button onClick={() => void createHandoff()} disabled={loadingHandoff || !plan || !observer} className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60">{loadingHandoff ? 'Hashing…' : 'Approval + Handoff'}</button>
            <button onClick={() => void startRuntimeGate()} disabled={loadingRuntimeGate || !handoff} className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-5 py-3 text-sm font-black text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60">{loadingRuntimeGate ? 'Checking…' : 'Start Runtime Gate'}</button>
            <button onClick={() => setPreviewMode('tools')} className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-3 text-sm font-black text-amber-100 hover:bg-amber-500/20">Governed Tools</button>
          </div>

          </details>

          <div role="status" aria-atomic="true" className={`mt-4 rounded-2xl border p-3 text-xs font-mono ${statusTone(status)}`}>
            <p>{status}</p>
            {createdJobUrl ? <a href={createdJobUrl} className="mt-2 inline-flex rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 font-bold text-emerald-100 hover:bg-emerald-500/20">Open job timeline: {createdJobUrl}</a> : null}
          </div>
        </section>

        {prd ? <PRDViewer prd={prd} /> : (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            ยังไม่มี PRD ของงานนี้ — กรอกเป้าหมายแล้วกด Generate PRD เพื่อสร้าง Draft จริง
          </div>
        )}
        {plan && observer && <PlanObserverPanel plan={plan} observer={observer} />}
        {approvalGate && handoff && <HandoffPanel approvalGate={approvalGate} handoff={handoff} />}
        {runtimeGate && <RuntimeGatePanel result={runtimeGate} />}
      </div>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5 shadow-2xl shadow-indigo-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-200">Live Preview</p>
              <h2 className="mt-1 text-2xl font-black text-white">พรีวิวแอปข้างๆ</h2>
            </div>
            <div className="flex rounded-2xl border border-slate-800 bg-slate-950 p-1 text-xs font-bold">
              {(['concept', 'live', 'monitor', 'brain', 'tools'] as PreviewMode[]).map((mode) => (
                <button key={mode} onClick={() => setPreviewMode(mode)} className={`rounded-xl px-3 py-2 ${previewMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{mode}</button>
              ))}
            </div>
          </div>

          {previewMode === 'concept' ? (
            <div className="mt-5 rounded-[2rem] border border-slate-800 bg-slate-950 p-4">
              <div className="rounded-[1.5rem] border border-slate-800 bg-gradient-to-br from-indigo-950 to-slate-950 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">Concept screen</p>
                <h3 className="mt-3 text-xl font-black text-white">{prd?.title || (goal.trim() ? 'ยังไม่ได้ Generate PRD' : 'ยังไม่ได้ระบุเป้าหมาย')}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{prd?.summary || (goal.trim() ? goal : 'กรอกเป้าหมายของแอปก่อน หน้าจอนี้จะไม่แสดง Demo เป็นผลลัพธ์จริง')}</p>
                <p className="mt-2 text-xs text-amber-300">{prd ? 'PRD_DRAFT_ONLY · ไม่ใช่แอปที่ Deploy' : 'USER_INPUT_ONLY · ยังไม่มี Build, Preview หรือ Execution'}</p>
                <div className="mt-5 grid gap-3">
                  {criteriaList.slice(0, 4).map((item) => <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-200">ข้อกำหนดที่ต้องทำ: {item}</div>)}
                </div>
              </div>
            </div>
          ) : null}

          {previewMode === 'live' ? (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-slate-950 p-5">
              <p className="text-sm font-black text-amber-200">LIVE_PREVIEW_NOT_VERIFIED</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                ยังไม่มี URL ของแอปที่สร้างจาก Job นี้พร้อมหลักฐาน Build/Deploy จริง
                ระบบจะไม่เปิดแอปตัวอย่าง ID เดิมเพื่อแอบอ้างว่าเป็นผลลัพธ์ใหม่
              </p>
              {createdJobUrl ? <a href={createdJobUrl} className="mt-3 inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">ตรวจ Job Timeline และ Evidence จริง</a> : (
                <p className="mt-2 text-xs text-amber-300">สร้าง Governed Job ก่อน แล้วตรวจสถานะในรายการงานที่บันทึก</p>
              )}
            </div>
          ) : null}

          {previewMode === 'monitor' ? (
            <div className="mt-5 space-y-3">
              {timeline.map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${stateTone(String(item.state))}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-white">{item.label}</p>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs">{item.state}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 opacity-85">{item.detail}</p>
                </div>
              ))}
            </div>
          ) : null}

          {previewMode === 'tools' ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Governed tool workbench</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-bold text-slate-300">Tool
                    <select value={toolKind} onChange={(event) => setToolKind(event.target.value as DsgGovernedToolKind)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-100">
                      {(['plan', 'workflow', 'schedule', 'persistent_compute', 'browser', 'search', 'api', 'google_workspace', 'file', 'shell'] as DsgGovernedToolKind[]).map((tool) => <option key={tool} value={tool}>{tool}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-300">Action
                    <input value={toolAction} onChange={(event) => setToolAction(event.target.value as DsgGovernedToolAction)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-100" />
                  </label>
                </div>
                <label className="mt-3 block text-xs font-bold text-slate-300">Args JSON
                  <textarea value={toolArgsText} onChange={(event) => setToolArgsText(event.target.value)} rows={8} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100" />
                </label>
                <label className="mt-3 block text-xs font-bold text-slate-300">Allowed hosts, one per line
                  <textarea value={toolAllowedHosts} onChange={(event) => setToolAllowedHosts(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100" placeholder="api.example.com" />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void runGovernedTool()} disabled={loadingGovernedTool} className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100 disabled:opacity-60">Inspect plan and policy</button>
                  <a href="/dsg/autonomous-level" className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-100">Verified user OAuth / signed read-only route</a>
                  <p className="w-full text-xs text-amber-200">HTTP Tool Inspector does not authorize execution or human approval. Protected provider actions require separately verified user, exact plan, signed approval when required, and a provider receipt.</p>
                </div>
              </div>
              <GovernedToolPanel prepared={governedPrepared} result={governedResult} busy={loadingGovernedTool} />
            </div>
          ) : null}

          {previewMode === 'brain' ? (
            <div className="mt-5 space-y-4">
              {agentLoop ? (
                <>
                  <div className={`rounded-2xl border p-4 ${stateTone(agentLoop.ok ? 'PASS' : 'BLOCK')}`}>
                    <p className="text-xs font-bold uppercase tracking-[0.2em]">Brain decision</p>
                    <p className="mt-2 text-2xl font-black text-white">{agentLoop.ok ? 'PASS' : 'REVIEW / BLOCK'}</p>
                    <p className="mt-2 text-xs leading-5 opacity-85">Risk: {agentLoop.risk?.state || 'unknown'} · productionReadyClaim=false</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Context pack</p>
                    <p className="mt-2 break-all text-xs text-slate-300">{agentLoop.contextPack?.contextHash || 'No context pack hash'}</p>
                    <p className="mt-2 text-xs text-slate-400">Gate: {agentLoop.contextPack?.gateStatus || 'unavailable'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Next actions</p>
                    <div className="mt-3 space-y-2">
                      {(agentLoop.nextActions || []).map((action) => <p key={action} className="rounded-xl bg-slate-900 p-2 text-xs text-slate-300">{action}</p>)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Memory used</p>
                    <div className="mt-3 space-y-2">
                      {(agentLoop.memories || []).length ? (agentLoop.memories || []).map((memory) => <p key={memory.id} className="rounded-xl bg-slate-900 p-2 text-xs leading-5 text-slate-300">[{memory.kind}/{memory.trust}] {memory.summary}</p>) : <p className="text-xs text-slate-400">No allowed memory returned yet.</p>}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                  Run Brain Loop first. It will search memory, create context pack, evaluate risk, record audit, and return next actions here.
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">User next action · current goal</p>
          <p role="status" className="mt-4 rounded-2xl border border-cyan-400/20 bg-slate-950 p-4 text-sm leading-6 text-cyan-100">{nextAction}</p>
          <p className="mt-3 text-xs text-slate-400">สถานะ: {status} · ไม่มีการอ้าง Runtime/Deploy สำเร็จหากยังไม่มีหลักฐานจริง</p>
          {createdJobUrl ? <a href={createdJobUrl} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm text-white">เปิด Job Timeline ที่บันทึกจริง</a> : null}
        </section>
      </aside>
    </div>
  );
}

// A new user-accepted outcome remounts the editing console with fresh input.
// No effect-based state copying or stale PRD/Plan/approval artifacts survives.
export function AppBuilderConsoleWorkspace() {
  const bridge = useAppBuilderGoalBridge();
  const accepted = bridge?.submitted;
  return <AppBuilderConsoleClient
    key={accepted?.revision ?? 0}
    initialGoal={accepted?.goal ?? bridge?.templateDraft?.goal ?? ''}
    initialCriteria={accepted?.criteria.join('\n') ?? bridge?.templateDraft?.criteria.join('\n') ?? ''}
    acceptedIntake={accepted?.intake}
  />;
}
