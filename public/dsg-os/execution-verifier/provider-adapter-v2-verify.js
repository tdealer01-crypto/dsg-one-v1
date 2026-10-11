// Browser/Node verifier for dsg-provider-adapter-v2 enriched results.
//
// This verifier never trusts a server-provided "verified" flag. It independently
// recomputes the gate record hash, provider result hash, execution record hash,
// cross-bindings, and Ed25519 attestation. A trustedKey pins signer identity.

import { canonicalJson, sha256Hex } from './laplacian-verify.js';
import { recordHashOf, verifyAttestation } from './attestation-verify.js';

export const PROVIDER_ADAPTER_SPEC = 'dsg-provider-adapter-v2';
export const PROVIDER_ADAPTER_METADATA_FIELD = '_dsg_provider_v2';
export const GATE_SPEC = 'dsg-gate-v1';
export const LIFECYCLE_PROFILE = 'lifecycle.idle_auth_exec';

async function objectHash(value) {
  return sha256Hex(canonicalJson(value));
}

async function gateRecordHash(record) {
  const { record_hash, ...rest } = record;
  return objectHash(rest);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export async function verifyProviderEnvelope(envelope, trustedKey = null) {
  const failures = [];
  const pinned = trustedKey !== null && trustedKey !== undefined && trustedKey !== '';

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { valid: false, pinned, failures: ['envelope must be an object'] };
  }

  let metadata;
  let providerResult;
  if (Object.prototype.hasOwnProperty.call(envelope, PROVIDER_ADAPTER_METADATA_FIELD)) {
    metadata = envelope[PROVIDER_ADAPTER_METADATA_FIELD];
    providerResult = Object.fromEntries(
      Object.entries(envelope).filter(([key]) => key !== PROVIDER_ADAPTER_METADATA_FIELD)
    );
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { valid: false, pinned, failures: ['provider adapter metadata missing'] };
    }
  } else if (
    envelope.spec === PROVIDER_ADAPTER_SPEC &&
    envelope.provider_result &&
    typeof envelope.provider_result === 'object' &&
    !Array.isArray(envelope.provider_result)
  ) {
    // Backward verifier support for the pre-merge nested envelop shape.
    metadata = envelope;
    providerResult = envelope.provider_result;
  } else {
    return { valid: false, pinned, failures: ['provider adapter metadata missing'] };
  }

  if (metadata.spec !== PROVIDER_ADAPTER_SPEC) {
    failures.push('unsupported provider adapter spec');
  }

  const adapter = metadata.adapter;
  const gate = metadata.gate;
  const record = metadata.execution_record;
  const attestation = metadata.attestation;

  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    failures.push('adapter metadata missing');
  }
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
    failures.push('gate record missing');
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    failures.push('execution record missing');
  }

  if (gate && typeof gate === 'object' && !Array.isArray(gate)) {
    if (gate.spec !== GATE_SPEC) failures.push('gate spec mismatch');
    if (gate.profile !== LIFECYCLE_PROFILE) failures.push('gate profile mismatch');
    if (gate.seq !== 0) failures.push('gate sequence mismatch');
    if (gate.decision !== 'ALLOW') failures.push('gate did not ALLOW execution');
    if (gate.record_hash !== (await gateRecordHash(gate))) {
      failures.push('gate record hash mismatch');
    }
  }

  if (record && typeof record === 'object' && !Array.isArray(record)) {
    if (record.spec !== PROVIDER_ADAPTER_SPEC) failures.push('execution record spec mismatch');
    if (record.record_hash !== (await recordHashOf(record))) {
      failures.push('execution record hash mismatch');
    }
    if (record.provider_result_hash !== (await objectHash(providerResult))) {
      failures.push('provider result hash mismatch');
    }
    if (gate && typeof gate === 'object' && !Array.isArray(gate)) {
      if (record.gate_record_hash !== gate.record_hash) {
        failures.push('execution record points to a different gate record');
      }
      const execution = gate.attachments && gate.attachments.execution;
      if (!execution || typeof execution !== 'object' || Array.isArray(execution)) {
        failures.push('gate execution binding missing');
      } else {
        const pairs = [
          ['adapter_id', 'adapter_id'],
          ['provider_type', 'provider_type'],
          ['plan_id', 'plan_id'],
          ['route_id', 'route_id'],
          ['agent_id', 'agent_id'],
          ['principal_hash', 'principal_hash'],
          ['decision_hash', 'decision_hash'],
          ['payload_hash', 'payload_hash'],
        ];
        for (const [gateKey, recordKey] of pairs) {
          if (!same(execution[gateKey], record[recordKey])) {
            failures.push(`gate execution binding mismatch: ${gateKey}`);
          }
        }
      }
    }
    if (adapter && typeof adapter === 'object' && !Array.isArray(adapter)) {
      if (record.adapter_id !== adapter.adapter_id) failures.push('adapter id mismatch');
      if (record.provider_type !== adapter.provider_type) failures.push('provider type mismatch');
    }
  }

  const attCheck = await verifyAttestation(attestation, record, trustedKey);
  if (!attCheck.valid) {
    failures.push(...attCheck.failures.map((item) => `attestation: ${item}`));
  }
  if (attestation && typeof attestation === 'object' && adapter && typeof adapter === 'object') {
    if (attestation.gate_id !== `provider-adapter:${adapter.adapter_id || ''}`) {
      failures.push('attestation gate_id mismatch');
    }
    if (attestation.sequence !== 0) failures.push('attestation sequence mismatch');
  }

  return { valid: failures.length === 0, pinned: attCheck.pinned ?? pinned, failures };
}
