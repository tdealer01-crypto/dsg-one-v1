import { NextResponse } from 'next/server';
import { routeAgentCommand } from '@/lib/dsg/agent-runtime/command-router';
import { requireVerifiedDsgActor } from '@/lib/dsg/server/context';

export async function POST(req: Request) {
  try {
    await requireVerifiedDsgActor(req.headers, 'job:read');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DSG_AUTH_FAILED';
    const status = code === 'DSG_AUTH_REQUIRED' ? 401 : code === 'DSG_CONTEXT_REQUIRED' || code === 'DSG_PERMISSION_DENIED' ? 403 : 500;
    return NextResponse.json({ ok: false, error: { code, message: code } }, { status });
  }

  const body = await req.json().catch(() => null) as {
    command?: string;
    context?: string;
    userBenefit?: string;
  } | null;

  if (!body?.command) {
    return NextResponse.json({ ok: false, error: { message: 'AGENT_COMMAND_REQUIRED' } }, { status: 400 });
  }

  try {
    return NextResponse.json({
      ok: true,
      data: routeAgentCommand({
        command: body.command,
        context: body.context,
        userBenefit: body.userBenefit,
      }),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { message: error instanceof Error ? error.message : 'AGENT_COMMAND_ROUTE_FAILED' },
    }, { status: 400 });
  }
}
