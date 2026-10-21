import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const file = readFileSync(
  join(process.cwd(), '.github/workflows/bind-kaggle-owner-ssm-once.yml'), 'utf8');
const launch = readFileSync(
  join(process.cwd(), 'app/api/dsg/agent-v0/launch/route.ts'), 'utf8');
const status = readFileSync(
  join(process.cwd(), 'app/api/dsg/agent-v0/lifecycle/route.ts'), 'utf8');

describe('one-time Kaggle PAT binding to existing AWS production', () => {
  it('requires the exact GitHub human owner and fresh workflow dispatch', () => {
    expect(file).toContain("github.actor == 'tdealer01-crypto'");
    expect(file).toContain("github.triggering_actor == 'tdealer01-crypto'");
    expect(file).toContain('github.run_attempt == 1');
    expect(file).toContain("github.ref == 'refs/heads/main'");
    expect(file).toContain('inputs.confirm == \'BIND_DSG_KAGGLE_OWNER_TOKEN\'');
    expect(file).toContain('cancel-in-progress: false');
  });

  it('pins AWS account, instance and SSM document hash without arbitrary shell', () => {
    expect(file).toContain('arn:aws:iam::121205961822:role/dsg-one-v1-github-deploy');
    expect(file).toContain('i-01a2ee90890a558c3');
    expect(file).toContain('DSG-ONE-Kaggle-Owner-Secret-Bind-v1');
    expect(file).toContain('1e6193632da016ef74d2e58945ed0522a0bd8017ce3b4d4d195f25f46eb73e87');
    expect(file).toContain('--document-version 1');
    expect(file).toContain('DSG_KAGGLE_BIND_SSM_DOCUMENT_DRIFT');
    expect(file).not.toContain('AWS-RunShellScript');
    expect(file).not.toContain('github.private_key');
  });

  it('never prints PAT, clones token, launches Kaggle or spends on GPU', () => {
    expect(file).toContain('/dsg/one/prod/kaggle-owner-dispatch-token');
    expect(file).toContain('SSM_OWNER_TOKEN_METADATA=VERIFIED_NO_DECRYPT');
    expect(file).toContain('Do not print stdout/stderr');
    expect(file).not.toContain('aws ssm get-parameter --with-decryption');
    expect(file).not.toContain('kaggle kernels push');
    expect(file).not.toContain('ec2 run-instances');
    expect(file).not.toContain('g4dn');
  });

  it('requires real website version and exact post-bind response without claiming a GPU ready', () => {
    expect(file).toContain('DSG_KAGGLE_OWNER_BIND=VERIFIED');
    expect(file).toContain('DSG_KAGGLE_BIND_PUBLIC_HEALTH=PASS');
    expect(file).toContain('.deployment.sourceBound==true');
    expect(file).toContain('.deployment.digestBound==true');
    expect(file).toContain('BLOCK=KAGGLE_OWNER_BIND_FAILED');
    expect(launch).toContain('KAGGLE_OWNER_DISPATCH_NOT_CONFIGURED');
    expect(launch).toContain("gpuState: 'UNVERIFIED'");
    expect(status).toContain("gpuState: 'UNVERIFIED'");
  });
});
