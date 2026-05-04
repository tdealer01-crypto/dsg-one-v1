import { getDevMemoryContext } from '@/lib/dsg/server/memory/context';
import { ingestMemory } from '@/lib/dsg/server/memory/repository';
import { asRecord, jsonFail, jsonOk, optionalString, statusForError } from '@/lib/dsg/server/memory/route-utils';
import type { DsgMemoryKind, DsgMemorySourceType, DsgMemoryStatus, DsgMemoryTrustLevel } from '@/lib/dsg/server/memory/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ctx = getDevMemoryContext(req, ['memory:write']);
    const body = asRecord(await req.json().catch(() => null));
    const rawText = optionalString(body.rawText);
    const contentHash = optionalString(body.contentHash);
    const sourceType = optionalString(body.sourceType) as DsgMemorySourceType | undefined;
    const memoryKind = optionalString(body.memoryKind) as DsgMemoryKind | undefined;

    if (!rawText) throw new Error('MEMORY_RAW_TEXT_REQUIRED');
    if (!contentHash) throw new Error('MEMORY_CONTENT_HASH_REQUIRED');
    if (!sourceType || !memoryKind) throw new Error('MEMORY_SOURCE_TYPE_AND_KIND_REQUIRED');

    const memory = await ingestMemory(ctx, {
      jobId: optionalString(body.jobId),
      sourceType,
      memoryKind,
      rawText,
      normalizedSummary: optionalString(body.normalizedSummary),
      trustLevel: optionalString(body.trustLevel) as DsgMemoryTrustLevel | undefined,
      status: optionalString(body.status) as DsgMemoryStatus | undefined,
      containsSecret: body.containsSecret === true,
      containsPii: body.containsPii === true,
      containsLegalClaim: body.containsLegalClaim === true,
      containsProductionClaim: body.containsProductionClaim === true,
      sourceEvidenceId: optionalString(body.sourceEvidenceId),
      sourceAuditId: optionalString(body.sourceAuditId),
      contentHash,
      metadata: asRecord(body.metadata),
    });
    return jsonOk({ memory }, 201);
  } catch (error) {
    return jsonFail(error, statusForError(error));
  }
}
