#!/usr/bin/env node

const appUrl = process.env.APP_URL || process.env.DSG_ONE_V1_PRODUCTION_URL;
if (!appUrl) {
  console.error(JSON.stringify({
    status: 'BLOCKED',
    error: 'APP_URL_REQUIRED',
    nextAction: 'Set APP_URL or DSG_ONE_V1_PRODUCTION_URL to the currently verified DSG ONE HTTPS runtime from AWS cutover evidence.',
  }, null, 2));
  process.exit(1);
}
let parsedAppUrl;
try {
  parsedAppUrl = new URL(appUrl);
} catch {
  console.error(JSON.stringify({
    status: 'BLOCKED',
    error: 'APP_URL_INVALID',
    nextAction: 'Provide a valid absolute HTTPS runtime URL.',
  }, null, 2));
  process.exit(1);
}
if (parsedAppUrl.protocol !== 'https:') {
  console.error(JSON.stringify({
    status: 'BLOCKED',
    error: 'APP_URL_HTTPS_REQUIRED',
    nextAction: 'Use the verified HTTPS runtime URL; do not use an unverified Azure fallback.',
  }, null, 2));
  process.exit(1);
}
const endpoint = `${parsedAppUrl.origin}/api/dsg/app-builder/proof`;

const response = await fetch(endpoint, { method: 'GET' });
const text = await response.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error('BLOCK: proof endpoint returned non-json');
  console.error(text.slice(0, 500));
  process.exit(1);
}

if (!response.ok || !json?.ok) {
  console.error('BLOCK: proof endpoint failed');
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

const assertions = json.assertions || {};
const boundary = json.claimBoundary || {};
const runtimeGate = json.runtimeGate || {};

const pass =
  json.status === 'PASS' &&
  assertions.promptToPrdWorks === true &&
  assertions.prdToPlanWorks === true &&
  assertions.handoffHashCreated === true &&
  assertions.runtimeGateBlocksWithoutExecutor === true &&
  assertions.runtimeDidNotStart === true &&
  assertions.productionReadyClaim === false &&
  boundary.productReadyClaim === false &&
  boundary.manusLevelClaim === false &&
  boundary.productionReadyClaim === false &&
  runtimeGate.status === 'BLOCKED' &&
  runtimeGate.boundary?.runtimeExecutionStarted === false;

if (!pass) {
  console.error('BLOCK: app builder flow proof assertions failed');
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

console.log('PASS: DSG App Builder flow proof completed fail-closed');
console.log(JSON.stringify({
  proofHash: json.proofHash,
  proofKind: json.proofKind,
  stages: json.stages,
  runtimeGateStatus: runtimeGate.status,
  runtimeFailures: runtimeGate.failures?.length || 0,
  claimBoundary: boundary,
}, null, 2));
