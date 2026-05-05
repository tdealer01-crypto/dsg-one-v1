#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const evidence = JSON.parse(readFileSync(process.env.DSG_EVIDENCE_FILE ?? 'dsg-production-flow-result.json', 'utf8'));
const checks = {
  buildVerified: evidence.buildVerified === true,
  previewDeployed: Boolean(evidence.previewUrl),
  healthProof: evidence.healthProofPassed === true,
  authRbacProof: evidence.authRbacProofPassed === true,
  productionFlowProof: evidence.production_flow_passed === true,
  replayAuditEvidenceHash: evidence.replayAuditEvidenceHashPassed === true,
};

let verdict = 'BLOCKED';
if (checks.buildVerified) verdict = 'BUILD_VERIFIED';
if (checks.buildVerified && checks.previewDeployed) verdict = 'PREVIEW_DEPLOYED';
if (checks.buildVerified && checks.previewDeployed && checks.healthProof && checks.authRbacProof && checks.productionFlowProof && checks.replayAuditEvidenceHash) verdict = 'PRODUCTION';
else if (checks.buildVerified && checks.previewDeployed) verdict = 'DEPLOYABLE';

console.log(JSON.stringify({ verdict, checks }, null, 2));
