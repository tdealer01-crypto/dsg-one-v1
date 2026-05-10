#!/usr/bin/env node

const fs = await import('node:fs/promises');
const crypto = await import('node:crypto');

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function readJson(path) {
  return fs.readFile(path, 'utf8').then((text) => JSON.parse(text));
}

function result(name, ok, missing, nextAction) {
  return { name, ok, status: ok ? 'PASS' : 'PROOF_REQUIRED', missing, nextAction };
}

function sandbox(proof) {
  const missing = [];
  if (!proof?.providerId) missing.push('providerId');
  if (!proof?.jobId) missing.push('jobId');
  if (!proof?.command) missing.push('command');
  if (typeof proof?.exitCode !== 'number') missing.push('exitCode');
  if (typeof proof?.durationMs !== 'number') missing.push('durationMs');
  if (!proof?.logRef) missing.push('logRef');
  if (!proof?.artifactRefs?.length) missing.push('artifactRefs');
  const ok = missing.length === 0 && proof.exitCode === 0;
  return result('sandbox', ok, missing, 'Run commands inside a real isolated provider and attach logs/artifacts.');
}

function repair(proof) {
  const missing = [];
  if (!proof?.jobId) missing.push('jobId');
  if (typeof proof?.maxAttempts !== 'number' || proof.maxAttempts < 1 || proof.maxAttempts > 5) missing.push('maxAttempts_1_to_5');
  if (!proof?.attempts?.length) missing.push('attempts');
  if (!proof?.stopReason) missing.push('stopReason');
  const ok = missing.length === 0 && proof.attempts.some((attempt) => attempt.result === 'PASS');
  return result('repair', ok, missing, 'Run bounded repair attempts from sandbox failure evidence.');
}

function browser(proof) {
  const missing = [];
  if (!proof?.providerId) missing.push('providerId');
  if (!proof?.sessionId) missing.push('sessionId');
  if (!proof?.jobId) missing.push('jobId');
  if (!proof?.startUrl?.startsWith('https://')) missing.push('startUrl_https');
  if (!proof?.navigationLogRef) missing.push('navigationLogRef');
  if (!proof?.screenshotRefs?.length) missing.push('screenshotRefs');
  if (!proof?.takeoverCheckpoints?.length) missing.push('takeoverCheckpoints');
  return result('browser', missing.length === 0, missing, 'Connect a real browser provider and capture screenshot/navigation/takeover proof.');
}

function timeline(proof) {
  const missing = [];
  if (!proof?.timelineId) missing.push('timelineId');
  if (!proof?.jobId) missing.push('jobId');
  if (!proof?.events?.length) missing.push('events');
  for (const kind of ['goal', 'plan', 'sandbox', 'preview', 'production', 'report']) {
    if (!proof?.events?.some((event) => event.kind === kind)) missing.push(`event_${kind}`);
  }
  return result('timeline', missing.length === 0, missing, 'Attach all required proof events to one ordered timeline.');
}

function preview(proof) {
  const missing = [];
  if (!proof?.jobId) missing.push('jobId');
  if (!proof?.deploymentUrl?.startsWith('https://')) missing.push('deploymentUrl_https');
  if (proof?.providerStatus !== 'READY') missing.push('providerStatus_READY');
  if (!proof?.routes?.length) missing.push('routes');
  for (const route of proof?.routes ?? []) {
    if (!route.path?.startsWith('/')) missing.push('route_path');
    if (route.status < 200 || route.status >= 400) missing.push(`route_${route.path}_status_${route.status}`);
    if (!route.bodyHash && !route.screenshotRef) missing.push(`route_${route.path}_bodyHash_or_screenshotRef`);
  }
  return result('preview', missing.length === 0, missing, 'Collect preview URL, route status, and body/screenshot proof.');
}

const proofPath = process.argv[2] || 'artifacts/dsg-provider-proof/provider-proof-bundle.json';
let bundle;
try {
  bundle = await readJson(proofPath);
} catch {
  console.error(JSON.stringify({
    ok: false,
    claim: 'DSG_PROVIDER_PROOF_REQUIRED',
    reason: `proof bundle not found: ${proofPath}`,
    expectedShape: ['sandbox', 'repair', 'browser', 'timeline', 'preview'],
  }, null, 2));
  process.exit(1);
}

const lanes = [sandbox(bundle.sandbox), repair(bundle.repair), browser(bundle.browser), timeline(bundle.timeline), preview(bundle.preview)];
const ok = lanes.every((lane) => lane.ok);
const output = {
  ok,
  claim: ok ? 'DSG_PROVIDER_PROOF_COMPLETE' : 'DSG_PROVIDER_PROOF_REQUIRED',
  proofHash: hash({ ok, lanes }),
  lanes,
};
console.log(JSON.stringify(output, null, 2));
process.exit(ok ? 0 : 1);
