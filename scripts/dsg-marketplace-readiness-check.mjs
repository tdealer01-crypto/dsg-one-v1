#!/usr/bin/env node

const appUrl = process.env.APP_URL || process.env.DSG_ONE_V1_PRODUCTION_URL;

if (!appUrl) {
  console.error('BLOCK: APP_URL or DSG_ONE_V1_PRODUCTION_URL is required');
  process.exit(1);
}

if (!appUrl.startsWith('https://')) {
  console.error('BLOCK: marketplace readiness check requires an https URL');
  process.exit(1);
}

const endpoint = `${appUrl.replace(/\/$/, '')}/api/dsg/marketplace/readiness`;
const response = await fetch(endpoint, {
  method: 'GET',
  headers: {
    accept: 'application/json',
    'user-agent': 'dsg-marketplace-readiness-check/1.0',
  },
  cache: 'no-store',
});

const text = await response.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error('BLOCK: readiness endpoint returned non-json');
  console.error(text.slice(0, 500));
  process.exit(1);
}

if (!response.ok || json?.ok !== true) {
  console.error('BLOCK: readiness endpoint failed');
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

const gates = Array.isArray(json.gates) ? json.gates : [];
const blocked = gates.filter((gate) => gate.status === 'BLOCKED');
const review = gates.filter((gate) => gate.status === 'REVIEW');
const pass = gates.filter((gate) => gate.status === 'PASS');
const validStatuses = gates.every((gate) => ['PASS', 'REVIEW', 'BLOCKED'].includes(gate.status));
const noMockRulePresent = json.noMockPolicy?.enforced === true && typeof json.noMockPolicy?.rule === 'string';

if (!validStatuses || !noMockRulePresent || gates.length === 0) {
  console.error('BLOCK: readiness report schema is invalid');
  console.error(JSON.stringify({ validStatuses, noMockRulePresent, gates: gates.length }, null, 2));
  process.exit(1);
}

console.log('PASS: marketplace readiness endpoint responded with a valid audit report');
console.log(JSON.stringify({
  endpoint,
  verdict: json.verdict,
  gates: gates.length,
  pass: pass.length,
  review: review.length,
  blocked: blocked.length,
  noMockPolicy: json.noMockPolicy,
}, null, 2));

if (json.verdict === 'PASS' && blocked.length > 0) {
  console.error('BLOCK: verdict cannot be PASS while blocked gates exist');
  process.exit(1);
}
