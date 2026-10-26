import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const page = source('app/dsg/app-builder/page.tsx');
const consoleSource = source('components/dsg/app-builder/AppBuilderConsoleClient.tsx');
const intake = source('components/dsg/app-builder/OutcomeIntakePanel.tsx');
const bridge = source('components/dsg/app-builder/AppBuilderGoalBridge.tsx');
const persistedJobsRoute = source('app/api/dsg/app-builder/jobs/route.ts');

describe('App Builder truth: user goal and real jobs, not a frozen demo', () => {
  it('does not initialize a PRD, goal, or preview as fake evidence', () => {
    expect(page).not.toContain('demoPrd');
    expect(page).toContain('<AppBuilderConsoleWorkspace />');
    expect(consoleSource).toContain("const [goal, setGoal] = useState(initialGoal)");
    expect(consoleSource).toContain("const [prd, setPrd] = useState<DsgAppBuilderPrd | null>(null)");
    expect(consoleSource).toContain('USER_INPUT_ONLY · ยังไม่มี Build, Preview หรือ Execution');
    expect(consoleSource).not.toContain("const liveGeneratedAppPath =");
    expect(consoleSource).not.toContain('iframe title="Generated app live preview"');
  });

  it('requires successful real PRD generation and clears stale claims on edits', () => {
    expect(consoleSource).toContain('function invalidateDerivedState()');
    for (const field of ['setPrd(null)', 'setPlan(null)', 'setObserver(null)', 'setHandoff(null)',
      'setRuntimeGate(null)', 'setCreatedJobUrl(null)', 'setAgentLoop(null)']) {
      expect(consoleSource).toContain(field);
    }
    expect(consoleSource).toContain('updateGoal(event.target.value)');
    expect(consoleSource).toContain('updateCriteria(event.target.value)');
    expect(consoleSource).toContain('disabled={loadingPlan || !prd}');
    expect(consoleSource).toContain('{prd ? <PRDViewer prd={prd} />');
  });

  it('loads only workspace-scoped real jobs from the server and allows explicit refresh', () => {
    expect(persistedJobsRoute).toContain("getAppBuilderRequestContext(req, 'job:read')");
    expect(consoleSource).toContain("fetch('/api/dsg/app-builder/jobs', {");
    expect(consoleSource).toContain("method: 'GET'");
    expect(consoleSource).toContain("cache: 'no-store'");
    expect(consoleSource).toContain('setSavedJobs(jobs)');
    expect(consoleSource).toContain('void refreshSavedJobs()');
    expect(consoleSource).toContain('JOB_DATABASE_UNAVAILABLE');
    expect(consoleSource).toContain('งานที่บันทึกจริง');
    expect(consoleSource).toContain('job.claimStatus');
    expect(consoleSource).not.toContain('localStorage.getItem(');
    expect(consoleSource).not.toContain('localStorage.setItem(');
  });

  it('shows current next action and treats requirements as pending, not completed proof', () => {
    expect(consoleSource).toContain('const nextAction = !goal.trim()');
    expect(consoleSource).toContain('User next action · current goal');
    expect(consoleSource).not.toContain('6. Open live preview and verify output.');
    expect(consoleSource).toContain('ข้อกำหนดที่ต้องทำ: {item}');
    expect(consoleSource).not.toContain('✓ {item}');
    expect(page).toContain('Static product readiness checklist');
  });

  it('does not show the old generated app as the result of a newly created job', () => {
    expect(consoleSource).toContain('LIVE_PREVIEW_NOT_VERIFIED');
    expect(consoleSource).toContain('ตรวจ Job Timeline และ Evidence จริง');
    expect(consoleSource).not.toContain("2f3b20b0-824c-4d4a-ae6a-250bd18f3392");
    expect(consoleSource).toContain('setCreatedJobUrl(url)');
    expect(consoleSource).toContain('await refreshSavedJobs()');
  });

  it('sends successful outcome intent to console without manufacturing proof or execution', () => {
    expect(page).toContain('requestedTemplate={query.template}');
    expect(page).toContain('key={JSON.stringify(query.template ?? null)}');
    expect(bridge).toContain('createContext<GoalBridge | null>');
    expect(intake).toContain("json.ok === true");
    expect(intake).toContain('bridge?.publish(json.intake)');
    expect(bridge).toContain('intake: DsgOutcomeIntake');
    expect(consoleSource).toContain('acceptedIntake={accepted?.intake}');
    expect(consoleSource).toContain('initialGoal={accepted?.goal');
    expect(consoleSource).toContain('initialCriteria={accepted?.criteria.join');
    expect(consoleSource).toContain('id="dsg-app-builder-console"');
    expect(bridge).not.toContain('APPROVED');
    expect(bridge).not.toContain('EXECUTED');
  });

  it('uses the normalized server-accepted intake snapshot, not mutable form values', () => {
    expect(intake).toContain('bridge?.publish(json.intake)');
    expect(intake).not.toContain('bridge?.publish(goal,');
    expect(bridge).toContain('publish(acceptedIntake: DsgOutcomeIntake)');
    expect(bridge).toContain('requiredIntegrations: [...acceptedIntake.requiredIntegrations]');
  });

  it('preserves production intent, risk, SSO, data and target users in governed job', () => {
    expect(consoleSource).toContain('OUTCOME_INPUT_CHANGED_REVALIDATION_REQUIRED');
    expect(consoleSource).toContain('acceptedIntake.productionIntent');
    expect(consoleSource).toContain('acceptedIntake.riskLevel');
    expect(consoleSource).toContain('acceptedIntake.requiredIntegrations');
    expect(consoleSource).toContain('acceptedIntake.availableData');
    expect(consoleSource).toContain('acceptedIntake.targetUsers');
    expect(consoleSource).toContain("auth: requiresAuth ? 'custom' : 'none'");
    expect(consoleSource).toContain('constraints,');
  });

  it('limits real jobs to 8 selected columns and scopes job detail to workspace identity', () => {
    const repository = source('lib/dsg/server/app-builder/repository.ts');
    const route = source('app/api/dsg/app-builder/jobs/[jobId]/route.ts');
    const detail = source('components/dsg/app-builder/AppBuilderJobDetailClient.tsx');
    expect(repository).toContain('&limit=8');
    expect(repository).toContain('select=id,workspace_id,created_by,status,claim_status,goal,created_at,updated_at');
    expect(route).toContain("getAppBuilderRequestContext(req, 'job:read')");
    expect(route).toContain('getAppBuilderJob(actor, jobId)');
    expect(detail).toContain('LIVE_PREVIEW_NOT_VERIFIED');
    expect(detail).not.toContain('2f3b20b0-824c-4d4a-ae6a-250bd18f3392');
    expect(detail).not.toContain('<iframe');
  });
});
