import { getDevMemoryContext } from '@/lib/dsg/server/memory/context';
import { createContextPack } from '@/lib/dsg/server/memory/repository';
import { asRecord, jsonFail, jsonOk, parseMemories, parseScope, statusForError, stringArray } from '@/lib/dsg/server/memory/route-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ctx = getDevMemoryContext(req, ['memory:context_pack', 'memory:read']);
    const body = asRecord(await req.json().catch(() => null));
    const memories = parseMemories(body.memories);
    if (!memories.length) throw new Error('MEMORIES_REQUIRED');
    const scope = parseScope(body.scope, 'planning');
    const contextPack = await createContextPack(ctx, {
      memories,
      scope,
      evidenceIds: stringArray(body.evidenceIds),
      auditIds: stringArray(body.auditIds),
    });
    return jsonOk({ contextPack }, 201);
  } catch (error) {
    return jsonFail(error, statusForError(error));
  }
}
