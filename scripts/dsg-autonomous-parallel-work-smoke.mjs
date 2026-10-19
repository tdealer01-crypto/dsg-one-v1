#!/usr/bin/env node

const fs = await import('node:fs/promises');

const files = [
  'lib/dsg/autonomous-level/sandbox-isolation-contract.ts',
  'lib/dsg/autonomous-level/repair-loop-contract.ts',
  'lib/dsg/autonomous-level/browser-session-contract.ts',
  'lib/dsg/autonomous-level/artifact-timeline-contract.ts',
  'lib/dsg/autonomous-level/preview-proof-contract.ts',
  'lib/dsg/autonomous-level/parallel-work-gate.ts',
  'lib/dsg/autonomous-level/provider-contracts.ts',
  'lib/dsg/autonomous-level/provider-proof-bundle.ts',
  'lib/dsg/autonomous-level/inherited-blindness-gate.ts',
  'lib/dsg/autonomous-level/independent-verifier-contract.ts',
  'lib/dsg/autonomous-level/browser-provider-profile.ts',
  'lib/dsg/autonomous-level/browser-privacy-guard.ts',
  'lib/dsg/autonomous-level/timeline-quality-gate.ts',
  'lib/dsg/autonomous-level/preview-scope-gate.ts',
  'skills/dsg-autonomous-execution/SKILL.md',
  'scripts/dsg-provider-proof-bundle-check.mjs',
];

for (const file of files) {
  await fs.access(file);
}

const skillText = await fs.readFile('skills/dsg-autonomous-execution/SKILL.md', 'utf8');
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(skillText);
if (!frontmatter) throw new Error('autonomous skill frontmatter missing');
if (!/^name:\s*dsg-autonomous-execution\s*$/m.test(frontmatter[1])) {
  throw new Error('autonomous skill frontmatter name invalid');
}
if (!/^description:\s*\S.+$/m.test(frontmatter[1])) {
  throw new Error('autonomous skill frontmatter description missing');
}
if (/onrender\.com/i.test(skillText)) {
  throw new Error('autonomous skill still references retired Render hostname');
}
if (!skillText.includes('DSG_ONE_WEB_BASE_URL')) {
  throw new Error('autonomous skill website smoke must use a configured URL');
}
for (const stage of ['### T0 Input Lock', '### T1 Dependency Graph Build', '### T2 Parallel Execute', '### T3 Deterministic Merge', '### T4 Verification Gate']) {
  if (!skillText.includes(stage)) throw new Error(`autonomous skill stage missing: ${stage}`);
}

// Release contract: the AWS image must contain this file and changes must trigger its build.
const imageDockerfile = await fs.readFile('Dockerfile', 'utf8');
const imageWorkflow = await fs.readFile('.github/workflows/build-aws-dsg-one.yml', 'utf8');
if (!imageDockerfile.includes('COPY --from=builder /app/skills/dsg-autonomous-execution/SKILL.md ./skills/dsg-autonomous-execution/SKILL.md')) {
  throw new Error('autonomous skill is missing from production Docker image');
}
if (!imageWorkflow.includes('skills/dsg-autonomous-execution/**')) {
  throw new Error('autonomous skill changes do not trigger AWS image build');
}

const combined = await Promise.all(files.map((file) => fs.readFile(file, 'utf8')));
const text = combined.join('\n');

const requiredTerms = [
  'evaluateSandboxIsolationProof',
  'evaluateRepairLoopProof',
  'evaluateBrowserSessionProof',
  'evaluateArtifactTimelineProof',
  'evaluatePreviewDeploymentProof',
  'evaluateDsgParallelAutonomousWork',
  'DsgAutonomousProviderBundle',
  'evaluateDsgProviderProofBundle',
  'evaluateInheritedBlindnessGate',
  'evaluateIndependentVerifierProof',
  'dsgBrowserProviderProfiles',
  'evaluateBrowserPrivacyGuard',
  'evaluateTimelineQualityGate',
  'evaluatePreviewScopeGate',
  'EMPTY_OUTPUT_NOT_PASS',
  'REPAIR_LOOP_BLOCKED_BY_UNTRUSTED_DIAGNOSTIC',
  'independentTool_must_differ',
  'DOM_OR_NETWORK_CAPTURE_REQUIRES_REDACTION',
  'PREVIEW_URL_PROOF_ONLY',
  'ISOLATED_PREVIEW_ENVIRONMENT_PROOF',
  'DSG_PROVIDER_PROOF_REQUIRED',
  'DSG_PROVIDER_PROOF_COMPLETE',
  'PROOF_REQUIRED',
  'DSG_AUTONOMOUS_RUNTIME_PROOF_INCOMPLETE',
];

for (const term of requiredTerms) {
  if (!text.includes(term)) throw new Error(`missing required term: ${term}`);
}

console.log('PASS: DSG autonomous parallel work smoke checks passed');
