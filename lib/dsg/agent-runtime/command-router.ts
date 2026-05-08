import { resolveAgentCapabilityGap } from '@/lib/dsg/agent-runtime/capability-gap-resolver';

export type AgentCommandIntent =
  | 'build_app'
  | 'call_openai'
  | 'open_browser'
  | 'create_remote_browser_session'
  | 'inspect_services'
  | 'resolve_capability_gap'
  | 'blocked';

export type AgentCommandInput = {
  command: string;
  context?: string;
  userBenefit?: string;
};

export type AgentCommandRoute = {
  intent: AgentCommandIntent;
  status: 'ready' | 'approval_required' | 'builder_required' | 'blocked';
  actionLabel: string;
  endpoint?: string;
  method?: 'GET' | 'POST';
  payload?: unknown;
  evidence: string[];
  userBenefit: string;
  truthBoundary: string;
};

const blockedPatterns = [
  /steal|exfiltrate|bypass|hack|phishing|malware|spyware/i,
  /secret key|private key|seed phrase|password dump/i,
  /delete production|drop database|wipe data/i,
];

function isBlocked(command: string) {
  return blockedPatterns.some((pattern) => pattern.test(command));
}

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

function isVirtualPcRequest(value: string) {
  return includesAny(value, [
    'virtual pc', 'virtual desktop', 'remote mouse', 'remote monitor', 'windows vm', 'windows desktop',
    'pc เสมือน', 'คอมเสมือน', 'คอมพิวเตอร์เสมือน', 'รีโมตเมาส์', 'รีโหมดเม้า', 'เมาส์', 'เม้าส์', 'เม้า',
    'มอนิเตอร์', 'จอ', 'วินโด้', 'วินโดว์', 'windows', 'ควบคุมจากที่อื่น', 'เอเจ้นคุม', 'agent control',
  ]);
}

function isBuildAppRequest(value: string) {
  return includesAny(value, ['build app', 'create app', 'generate app', 'สร้างแอป', 'ทำแอป', 'แอป']) || isVirtualPcRequest(value);
}

export function routeAgentCommand(input: AgentCommandInput): AgentCommandRoute {
  const command = input.command.trim();
  if (!command) throw new Error('AGENT_COMMAND_REQUIRED');

  const value = `${command} ${input.context || ''}`.toLowerCase();
  const userBenefit = input.userBenefit?.trim() || 'The user gets a concrete next action instead of an unclear agent response.';

  if (isBlocked(command)) {
    return {
      intent: 'blocked',
      status: 'blocked',
      actionLabel: 'Blocked by safety boundary',
      evidence: ['blockedCommand', 'policyReason'],
      userBenefit: 'The user is protected from unsafe or destructive automation.',
      truthBoundary: 'The command was not executed. It requires human review and a safe redesign.',
    };
  }

  if (isBuildAppRequest(value)) {
    const virtualPc = isVirtualPcRequest(value);
    return {
      intent: 'build_app',
      status: 'approval_required',
      actionLabel: virtualPc ? 'Create governed Virtual PC Agent App job' : 'Create governed App Builder job',
      endpoint: '/api/dsg/app-builder/jobs',
      method: 'POST',
      payload: virtualPc
        ? {
            goal: command,
            successCriteria: [
              'Virtual PC monitor surface is visible in the app',
              'Remote mouse API contract exists for external agents',
              'DSG invariant gate evaluates every remote mouse action before execution',
              'Every governed action returns audit/evidence output',
              'The builder returns PR/branch/proof evidence before production deployment',
            ],
            constraints: [
              'Do not claim a real Windows VM is provisioned until a provider proves it',
              'Do not use mock evidence as production proof',
              'Remote mouse actions must be policy-gated and auditable',
              'External login, install, or privileged settings require takeover/approval',
            ],
          }
        : {
            goal: command,
            successCriteria: ['Visible plan is created', 'User approves before runtime execution', 'PR/evidence is returned after build'],
          },
      evidence: ['jobId', 'planHash', 'approvalHash', 'pullRequestUrl'],
      userBenefit,
      truthBoundary: virtualPc
        ? 'This creates a governed Builder request for a Virtual PC Agent App. It does not claim a real Windows VM exists until a verified runtime/provider proves it.'
        : 'This routes to the App Builder. It does not deploy production automatically.',
    };
  }

  if (includesAny(value, ['summarize', 'draft', 'rewrite', 'plan', 'openai', 'ai answer', 'เขียน', 'สรุป'])) {
    return {
      intent: 'call_openai',
      status: 'ready',
      actionLabel: 'Use server-side OpenAI adapter',
      endpoint: '/api/dsg/ai/openai/chat',
      method: 'POST',
      payload: { input: command },
      evidence: ['responseId', 'model', 'usage', 'outputText'],
      userBenefit,
      truthBoundary: 'OpenAI output is generated text. It is not evidence unless verified against source data.',
    };
  }

  if (includesAny(value, ['open url', 'open site', 'เปิดเว็บ', 'เปิดลิงก์'])) {
    return {
      intent: 'open_browser',
      status: 'ready',
      actionLabel: 'Open URL in user browser',
      endpoint: 'client:browser.open',
      method: 'POST',
      payload: { command },
      evidence: ['userVisibleUrl', 'manualScreenshot'],
      userBenefit,
      truthBoundary: 'This opens a local browser page only. It is not autonomous remote browsing proof.',
    };
  }

  if (includesAny(value, ['remote browser', 'browserbase', 'playwright', 'screenshot', 'takeover', 'manus', 'รีโมตบราวเซอร์'])) {
    return {
      intent: 'create_remote_browser_session',
      status: 'approval_required',
      actionLabel: 'Create remote browser session contract',
      endpoint: '/api/dsg/remote-browser/sessions',
      method: 'POST',
      payload: { task: command },
      evidence: ['sessionId', 'navigationLog', 'checkpoint', 'artifact'],
      userBenefit,
      truthBoundary: 'Remote browser API contract exists. Real autonomous execution depends on a verified provider adapter.',
    };
  }

  if (includesAny(value, ['services', 'capabilities', 'tools', 'เอเจนต์ทำอะไรได้', 'มีเครื่องมืออะไร'])) {
    return {
      intent: 'inspect_services',
      status: 'ready',
      actionLabel: 'List available agent runtime services',
      endpoint: '/api/dsg/agent-runtime/services',
      method: 'GET',
      evidence: ['serviceId', 'status', 'endpoint', 'truthBoundary'],
      userBenefit,
      truthBoundary: 'The service list reflects registered capabilities, not proof that every external connector is configured.',
    };
  }

  const gap = resolveAgentCapabilityGap({
    requestedAction: command,
    currentCapability: input.context,
    userBenefit,
  });

  return {
    intent: 'resolve_capability_gap',
    status: 'builder_required',
    actionLabel: 'Create missing capability through App Builder',
    endpoint: '/api/dsg/agent-runtime/capability-gaps',
    method: 'POST',
    payload: gap,
    evidence: ['gapType', 'recommendedBuilderGoal', 'successCriteria', 'constraints'],
    userBenefit,
    truthBoundary: 'The agent cannot honestly claim this capability exists yet. It must create a governed Builder request first.',
  };
}
