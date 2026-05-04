import { getDevMemoryContext } from '@/lib/dsg/server/memory/context';
import { gateMemory } from '@/lib/dsg/server/memory/repository';
import { asRecord, jsonFail, jsonOk, optionalString, parseMemories, parseScope, statusForError } from '@/lib/dsg/server/memory/route-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ctx = getDevMemoryContext(req, ['memory:gate', 'memory:read']);
    const body = asRecord(await req.json().catch(() => null));
    const memories = parseMemories(body.memories);
    if (!memories.length) throw new Error('MEMORIES_REQUIRED');
    const scope = parseScope(body.scope, 'planning');
    const gate = await gateMemory(ctx, {
      memories,
      scope,
      queryText: optionalString(body.queryText) ?? 'memory-gate',
    });
    return jsonOk({ gate });
  } catch (error) {
    return jsonFail(error, statusForError(error));
  }
}
