// Browser/Node port of dsg_spacetime.attestation.verify_attestation (Ed25519 via Web Crypto).
// Truth boundary: a valid signature proves "signed by this key, unchanged since". It only
// proves WHO signed if the verifier pins a public key obtained out of band (trustedKey).

import { canonicalJson, sha256Hex } from './laplacian-verify.js';

export const ATTESTATION_SPEC = 'dsg-attestation-v1';

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function recordHashOf(record) {
  const { record_hash, ...rest } = record;
  return sha256Hex(canonicalJson(rest));
}

export async function verifyAttestation(att, record, trustedKey = null) {
  const failures = [];
  if (!att || typeof att !== 'object' || !record || typeof record !== 'object') {
    return { valid: false, pinned: false, failures: ['attestation and record must be objects'] };
  }
  if (att.spec !== ATTESTATION_SPEC || att.alg !== 'Ed25519') failures.push('unsupported attestation spec/alg');
  if (record.record_hash !== (await recordHashOf(record))) failures.push('record content does not match its record_hash');
  if (att.record_hash !== record.record_hash) failures.push('attestation signs a different record_hash');
  const pinned = trustedKey !== null && trustedKey !== undefined && trustedKey !== '';
  if (pinned && att.public_key !== trustedKey) failures.push('public key is not the pinned trusted key');
  try {
    const key = await globalThis.crypto.subtle.importKey('raw', b64(att.public_key), { name: 'Ed25519' }, false, ['verify']);
    const msg = new TextEncoder().encode(canonicalJson({
      spec: ATTESTATION_SPEC, sequence: att.sequence, gate_id: att.gate_id, record_hash: att.record_hash,
    }));
    if (!(await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, b64(att.signature), msg))) {
      failures.push('Ed25519 signature invalid');
    }
  } catch (e) {
    failures.push('Ed25519 signature invalid');
  }
  return { valid: failures.length === 0, pinned, failures };
}
