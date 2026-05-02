import { sha256Json } from '../runtime/hash';
import type { RiskLevel } from '../runtime/types';

export type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: unknown[];
  requestBody?: unknown;
};

export type OpenApiDocument = {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

export type GovernedTool = {
  name: string;
  method: string;
  path: string;
  description: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  schemaHash: string;
};

const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);

export function classifyOperationRisk(method: string, operation: OpenApiOperation): RiskLevel {
  const text = `${method} ${operation.operationId ?? ''} ${operation.summary ?? ''} ${operation.description ?? ''}`.toLowerCase();
  if (text.includes('delete') || text.includes('payment') || text.includes('transfer')) return 'CRITICAL';
  if (mutationMethods.has(method.toLowerCase())) return 'HIGH';
  return 'MEDIUM';
}

export function openApiToGovernedTools(document: OpenApiDocument): GovernedTool[] {
  const paths = document.paths ?? {};
  const tools: GovernedTool[] = [];

  for (const path of Object.keys(paths).sort()) {
    const operations = paths[path];
    for (const method of Object.keys(operations).sort()) {
      const operation = operations[method];
      const riskLevel = classifyOperationRisk(method, operation);
      const name = operation.operationId ?? `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`.replace(/^_+|_+$/g, '');
      tools.push({
        name,
        method: method.toUpperCase(),
        path,
        description: operation.summary ?? operation.description ?? name,
        riskLevel,
        requiresApproval: riskLevel === 'HIGH' || riskLevel === 'CRITICAL',
        schemaHash: sha256Json({ method, path, operation }),
      });
    }
  }

  return tools;
}
