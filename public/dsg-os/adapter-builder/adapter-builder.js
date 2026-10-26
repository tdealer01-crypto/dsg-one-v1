// DSG OS Adapter Builder — browser-side deterministic contract compiler.
//
// Authoring only: this module cannot execute a provider or grant authority.
// The compiled Route must still be registered and authorized by DSG Spacetime.

import { canonicalJson, sha256Hex } from '../execution-verifier/laplacian-verify.js';

export const ADAPTER_CONTRACT_SPEC = 'dsg-adapter-contract-v1';
export const ADAPTER_CATALOG_SPEC = 'dsg-adapter-catalog-v1';
export const PROVIDER_TYPES = Object.freeze([
  'mcp','http','api','webhook','browser','rdc','desktop','cli','shell','server',
  'database','a2a','filesystem','process','deploy','cloud','git','github','secrets',
  'device','xr',
]);
export const RISKS = Object.freeze(['low','medium','high','critical']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, code, max) {
  if (typeof value !== 'string') fail(code);
  const out = value.trim();
  if (!out || out.length > max) fail(code);
  return out;
}

function plainObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return structuredClone(value);
}

export function normalizeAdapterContract(input) {
  const value = plainObject(input, 'ADAPTER_CONTRACT_OBJECT_REQUIRED');
  const allowed = new Set([
    'spec','adapter_id','provider_type','capability','route_id','source_node','target_node',
    'risk','required_scopes','approval_required','bind_payload','signed_approval_required',
    'input_schema','output_schema','result_verifier','evidence_mapping',
  ]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail('ADAPTER_CONTRACT_FIELD_NOT_ALLOWED');

  const providerType = text(value.provider_type, 'PROVIDER_TYPE_REQUIRED', 64).toLowerCase();
  if (!PROVIDER_TYPES.includes(providerType)) fail('PROVIDER_TYPE_NOT_ALLOWED');
  const risk = value.risk === undefined ? 'medium' : text(value.risk, 'ADAPTER_RISK_REQUIRED', 16).toLowerCase();
  if (!RISKS.includes(risk)) fail('ADAPTER_RISK_NOT_ALLOWED');

  const scopes = value.required_scopes === undefined ? [] : value.required_scopes;
  if (!Array.isArray(scopes)) fail('ADAPTER_SCOPES_INVALID');
  const normalizedScopes = scopes.map((scope) => text(scope, 'ADAPTER_SCOPE_EMPTY', 192));
  if (new Set(normalizedScopes).size !== normalizedScopes.length) fail('ADAPTER_SCOPE_DUPLICATE');

  const approvalRequired = value.approval_required === true;
  const bindPayload = value.bind_payload === true;
  const signedApprovalRequired = value.signed_approval_required === true;
  if (signedApprovalRequired && !approvalRequired) fail('SIGNED_APPROVAL_REQUIRES_APPROVAL_GATE');
  if ((risk === 'high' || risk === 'critical') && !approvalRequired) {
    fail('HIGH_RISK_ADAPTER_REQUIRES_APPROVAL');
  }
  if ((risk === 'high' || risk === 'critical') && !bindPayload) {
    fail('HIGH_RISK_ADAPTER_REQUIRES_PAYLOAD_BINDING');
  }

  return {
    spec: value.spec === undefined ? ADAPTER_CONTRACT_SPEC : value.spec,
    adapter_id: text(value.adapter_id, 'ADAPTER_ID_REQUIRED', 192),
    provider_type: providerType,
    capability: text(value.capability, 'ADAPTER_CAPABILITY_REQUIRED', 192),
    route_id: text(value.route_id, 'ADAPTER_ROUTE_ID_REQUIRED', 192),
    source_node: text(value.source_node, 'ADAPTER_SOURCE_NODE_REQUIRED', 128),
    target_node: text(value.target_node, 'ADAPTER_TARGET_NODE_REQUIRED', 128),
    risk,
    required_scopes: normalizedScopes,
    approval_required: approvalRequired,
    bind_payload: bindPayload,
    signed_approval_required: signedApprovalRequired,
    input_schema: plainObject(value.input_schema ?? {}, 'ADAPTER_INPUT_SCHEMA_INVALID'),
    output_schema: plainObject(value.output_schema ?? {}, 'ADAPTER_OUTPUT_SCHEMA_INVALID'),
    result_verifier: text(value.result_verifier ?? 'provider_readback', 'ADAPTER_RESULT_VERIFIER_REQUIRED', 128),
    evidence_mapping: plainObject(value.evidence_mapping ?? {}, 'ADAPTER_EVIDENCE_MAPPING_INVALID'),
  };
}

export async function compileAdapterContract(input) {
  const contract = normalizeAdapterContract(input);
  if (contract.spec !== ADAPTER_CONTRACT_SPEC) fail('ADAPTER_CONTRACT_SPEC_UNSUPPORTED');
  const contractHash = await sha256Hex(canonicalJson(contract));
  const route = {
    route_id: contract.route_id,
    source_node: contract.source_node,
    target_node: contract.target_node,
    capability: contract.capability,
    risk: contract.risk,
    approval_required: contract.approval_required,
    bind_payload: contract.bind_payload,
    signed_approval_required: contract.signed_approval_required,
    payload_contract: {
      spec: ADAPTER_CONTRACT_SPEC,
      adapter_id: contract.adapter_id,
      provider_type: contract.provider_type,
      required_scopes: contract.required_scopes,
      input_schema: contract.input_schema,
      output_schema: contract.output_schema,
      result_verifier: contract.result_verifier,
      evidence_mapping: contract.evidence_mapping,
      contract_hash: contractHash,
    },
  };
  return { spec: ADAPTER_CONTRACT_SPEC, contract_hash: contractHash, contract, route };
}


export async function compileAdapterCatalog(input) {
  const value = plainObject(input, 'ADAPTER_CATALOG_OBJECT_REQUIRED');
  const allowed = new Set(['spec', 'contracts']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail('ADAPTER_CATALOG_FIELD_NOT_ALLOWED');
  const spec = value.spec === undefined ? ADAPTER_CATALOG_SPEC : value.spec;
  if (spec !== ADAPTER_CATALOG_SPEC) fail('ADAPTER_CATALOG_SPEC_UNSUPPORTED');
  if (!Array.isArray(value.contracts) || value.contracts.length === 0) {
    fail('ADAPTER_CATALOG_CONTRACTS_REQUIRED');
  }

  const normalized = value.contracts.map(normalizeAdapterContract);
  const adapterIds = normalized.map((item) => item.adapter_id);
  const routeIds = normalized.map((item) => item.route_id);
  if (new Set(adapterIds).size !== adapterIds.length) fail('ADAPTER_CATALOG_ADAPTER_ID_DUPLICATE');
  if (new Set(routeIds).size !== routeIds.length) fail('ADAPTER_CATALOG_ROUTE_ID_DUPLICATE');

  const ordered = [...normalized].sort((a, b) =>
    a.route_id.localeCompare(b.route_id) || a.adapter_id.localeCompare(b.adapter_id)
  );
  const catalogHash = await sha256Hex(canonicalJson({ spec: ADAPTER_CATALOG_SPEC, contracts: ordered }));
  const contracts = [];
  for (const contract of ordered) contracts.push(await compileAdapterContract(contract));
  return { spec: ADAPTER_CATALOG_SPEC, catalog_hash: catalogHash, contracts };
}
