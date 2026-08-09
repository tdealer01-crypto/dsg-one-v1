import { readFile } from 'node:fs/promises';

const base = process.env.DSG_AIMO_APP_URL ?? process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const apiKey = process.env.DSG_API_KEY;
if (!base) throw new Error('Set DSG_AIMO_APP_URL, APP_URL, or NEXT_PUBLIC_APP_URL');
if (!apiKey) throw new Error('Set DSG_API_KEY for the fail-closed AIMO endpoint');

const problemFile = process.env.DSG_AIMO_PROBLEM_FILE;
const problem = problemFile
  ? JSON.parse(await readFile(problemFile, 'utf8'))
  : {
      problemId: 'sealed-connectivity-smoke-v1',
      statement: 'Minimize the supplied exact QUBO encoding.',
      domain: 'combinatorics',
      constraints: {
        aimoEncoding: {
          kind: 'qubo-v1',
          variableCount: 3,
          linear: [
            { i: 0, weight: '-4' },
            { i: 1, weight: '-3' },
            { i: 2, weight: '1' },
          ],
          quadratic: [
            { i: 0, j: 1, weight: '5' },
            { i: 1, j: 2, weight: '2' },
          ],
        },
      },
    };

const shardCount = Number(process.env.DSG_AIMO_SMOKE_SHARDS ?? '4');
const parallelism = Number(process.env.DSG_AIMO_SMOKE_PARALLELISM ?? String(shardCount));
const url = new URL('/api/dsg/aimo/solve', base);

async function runOnce() {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DSG-Api-Key': apiKey,
    },
    body: JSON.stringify({
      problem,
      shardCount,
      parallelism,
      maxCandidatesPerShard: 4,
      requireAllShards: true,
      nvidiaIsing: { mode: 'off' },
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(`AIMO smoke HTTP ${response.status}: ${JSON.stringify(body)}`);
  if (body?.data?.verdict !== 'PASS') throw new Error(`AIMO smoke did not PASS: ${JSON.stringify(body)}`);
  if (body?.data?.deterministicCore !== true) throw new Error('deterministicCore != true');
  if (body?.data?.selectedVerification?.certificateLevel !== 'VERIFIED_GLOBAL_OPTIMUM') {
    throw new Error('Cinema did not return VERIFIED_GLOBAL_OPTIMUM');
  }
  return body.data;
}

const first = await runOnce();
const second = await runOnce();

for (const field of ['problemHash', 'shardPlanHash', 'receiptHash']) {
  if (first[field] !== second[field]) {
    throw new Error(`deterministic replay mismatch in ${field}: ${first[field]} != ${second[field]}`);
  }
}
if (first.selectedCandidate?.candidateHash !== second.selectedCandidate?.candidateHash) {
  throw new Error('selected candidate hash changed across replay');
}
if (first.selectedVerification?.proofHash !== second.selectedVerification?.proofHash) {
  throw new Error('Cinema proof hash changed across replay');
}

console.log(JSON.stringify({
  status: 'PASS',
  endpoint: url.toString(),
  problemHash: first.problemHash,
  shardPlanHash: first.shardPlanHash,
  searchCoverage: first.searchCoverage,
  selectedCandidateHash: first.selectedCandidate?.candidateHash,
  cinemaProofHash: first.selectedVerification?.proofHash,
  certificateLevel: first.selectedVerification?.certificateLevel,
  receiptHash: first.receiptHash,
  deterministicReplay: true,
}, null, 2));
