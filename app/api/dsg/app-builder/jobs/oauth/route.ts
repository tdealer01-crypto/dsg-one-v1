import { NextResponse } from 'next/server';
import { listAppBuilderJobs } from '@/lib/dsg/server/app-builder/repository';
import { classifyAppBuilderJobError } from '@/lib/dsg/server/app-builder/job-error';
import { McpUserJobsDenied, verifiedMcpAppBuilderReadContext } from '@/lib/dsg/server/app-builder/mcp-user-context';

export const dynamic = 'force-dynamic';

// Dedicated read-only Auth0 user delegation boundary for the future governed
// Spacetime adapter. Do not route static MCP service credentials here.
// No deployment or build claims are created by reading Workspace Jobs.
export async function GET(request: Request) {
  try {
    // Protect the direct public endpoint, not only the MCP forwarding path.
    // This must remain off until owner-authorized coordinated activation.
    if (process.env.DSG_SPACETIME_JOBS_DELEGATION_ACTIVE !== 'true') {
      throw new McpUserJobsDenied('DSG_MCP_JOBS_DELEGATION_NOT_ACTIVE', 503);
    }
    const context = await verifiedMcpAppBuilderReadContext(request.headers);
    const jobs = await listAppBuilderJobs(context, { timeoutMs: 5_000 });
    return NextResponse.json({ ok: true, data: jobs }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const failure = error instanceof McpUserJobsDenied
      ? { code: error.code, status: error.status }
      : classifyAppBuilderJobError(error);
    return NextResponse.json({ ok: false, error: { code: failure.code } }, {
      status: failure.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
