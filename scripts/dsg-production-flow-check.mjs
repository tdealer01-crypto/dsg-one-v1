import { createHash } from 'node:crypto';

const productionUrl = process.env.DSG_ONE_V1_PRODUCTION_URL;

if (!productionUrl) {
  console.error('DSG production flow check failed: DSG_ONE_V1_PRODUCTION_URL is required');
  process.exit(1);
}

if (!productionUrl.startsWith('https://')) {
  console.error('DSG production flow check failed: production URL must use https');
  process.exit(1);
}

const startedAt = new Date().toISOString();
const response = await fetch(productionUrl, {
  method: 'GET',
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'User-Agent': 'dsg-production-flow-check/1.0',
  },
  cache: 'no-store',
});

const body = await response.text();
const completedAt = new Date().toISOString();
const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
const proofHash = createHash('sha256')
  .update(JSON.stringify({ productionUrl, status: response.status, ok: response.ok, bodyHash, startedAt, completedAt }), 'utf8')
  .digest('hex');

if (!response.ok) {
  console.error(`DSG production flow check failed: status ${response.status}`);
  console.error(`proofHash=sha256:${proofHash}`);
  process.exit(1);
}

console.log('DSG production flow check passed');
console.log(`url=${productionUrl}`);
console.log(`status=${response.status}`);
console.log(`bodyHash=sha256:${bodyHash}`);
console.log(`proofHash=sha256:${proofHash}`);
console.log(`startedAt=${startedAt}`);
console.log(`completedAt=${completedAt}`);
