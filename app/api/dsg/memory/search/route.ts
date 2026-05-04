import { getDevMemoryContext } from '@/lib/dsg/server/memory/context';
import { searchMemory } from '@/lib/dsg/server/memory/repository';
import { jsonFail, jsonOk, optionalString, statusForError } from '@/lib/dsg/server/memory/route-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const ctx = getDevMemoryContext(req, ['memory:read']);
    const url = new URL(req.url);
    const limitValue = Number(url.searchParams.get('limit') ?? '20');
    const memories = await searchMemory(ctx, {
      query: optionalString(url.searchParams.get('q')),
      jobId: optionalString(url.searchParams.get('jobId')),
      limit: Number.isFinite(limitValue) ? limitValue : 20,
    });
    return jsonOk({ memories, count: memories.length });
  } catch (error) {
    return jsonFail(error, statusForError(error));
  }
}
