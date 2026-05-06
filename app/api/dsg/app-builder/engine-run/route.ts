import { NextResponse } from 'next/server';
import {
  DSG_APP_BUILDER_ENGINES,
  type DsgAppBuilderEngineId,
  type DsgAppBuilderEngineRunInput,
  type DsgAppBuilderEngineRunResult,
} from '@/lib/dsg/app-builder/engines/engine-contract';

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'APP_BUILDER_ENGINE_RUN_FAILED';
  return NextResponse.json({ ok: false, error: { code: message, message } }, { status: 400 });
}

function requireEngine(engineId: DsgAppBuilderEngineId) {
  const engine = DSG_APP_BUILDER_ENGINES.find((candidate) => candidate.id === engineId);
  if (!engine) throw new Error('APP_BUILDER_ENGINE_NOT_FOUND');
  return engine;
}

function inferPreview(goal: string, criteria: string[]) {
  const normalized = goal.toLowerCase();
  if (normalized.includes('abc') || normalized.includes('เกม')) {
    return {
      title: 'ABC Toddler Game Preview',
      screens: ['Start game', 'Question card', 'A/B/C answer buttons', 'Score summary', 'Saved score history'],
      dataObjects: ['game_round', 'score_result', 'saved_item'],
      apiRoutes: ['/api/generated-apps/:appId/items'],
    };
  }
  if (normalized.includes('จอง') || normalized.includes('booking')) {
    return {
      title: 'Booking App Preview',
      screens: ['Booking form', 'Available slots', 'Owner queue dashboard', 'Confirmation state'],
      dataObjects: ['booking', 'customer', 'slot'],
      apiRoutes: ['/api/generated-apps/:appId/bookings'],
    };
  }
  if (normalized.includes('crm')) {
    return {
      title: 'CRM Preview',
      screens: ['Contact list', 'Deal status board', 'Follow-up task panel', 'Notes history'],
      dataObjects: ['contact', 'deal', 'task', 'note'],
      apiRoutes: ['/api/generated-apps/:appId/contacts', '/api/generated-apps/:appId/tasks'],
    };
  }
  return {
    title: 'Generated App Preview',
    screens: ['Landing screen', 'Create record form', 'Saved records table', 'Evidence status panel'],
    dataObjects: criteria.length ? criteria.slice(0, 4).map((item) => item.toLowerCase().replace(/[^a-z0-9ก-๙]+/gi, '_')) : ['record'],
    apiRoutes: ['/api/generated-apps/:appId/items'],
  };
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as Partial<DsgAppBuilderEngineRunInput>;
    if (!input.jobId) throw new Error('APP_BUILDER_JOB_ID_REQUIRED');
    if (!input.goal?.trim()) throw new Error('APP_BUILDER_GOAL_REQUIRED');
    const engineId = (input.engineId || 'dsg-native') as DsgAppBuilderEngineId;
    const mode = input.mode || 'preview_only';
    const engine = requireEngine(engineId);
    const successCriteria = Array.isArray(input.successCriteria) ? input.successCriteria : [];
    const preview = inferPreview(input.goal, successCriteria);
    const blocked = engine.status === 'blocked' || (mode === 'generate_pr' && engine.status !== 'available');

    const result: DsgAppBuilderEngineRunResult = {
      ok: true,
      jobId: input.jobId,
      engineId,
      mode,
      claimStatus: blocked ? 'BLOCKED' : mode === 'generate_pr' ? 'IMPLEMENTED_UNVERIFIED' : 'PLANNED_ONLY',
      summary: blocked
        ? `${engine.label} is not ready for this run mode. Use DSG Native preview first or configure required evidence.`
        : `${engine.label} produced a governed ${mode.replace('_', ' ')} result with DSG evidence gates still active.`,
      nextActions: blocked
        ? ['Use dsg-native preview mode', 'Configure required environment variables', 'Keep production claim blocked']
        : ['Review preview screens', 'Check required evidence', 'Run PRD/Plan/Handoff gates', 'Generate PR only after sandbox and license gates pass'],
      preview,
      evidence: {
        licenseGate: engine.licenseBoundary,
        sandboxGate: engine.capabilities.includes('sandbox') ? 'SANDBOX_REQUIRED' : 'NOT_APPLICABLE_FOR_PREVIEW',
        pathGate: 'ALLOWED_PATHS_REQUIRED_BEFORE_FILE_WRITE',
        secretGate: engine.requiredEnv.length ? `REQUIRES_${engine.requiredEnv.join('_')}` : 'NO_ENGINE_SECRET_REQUIRED',
        productionClaim: false,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
