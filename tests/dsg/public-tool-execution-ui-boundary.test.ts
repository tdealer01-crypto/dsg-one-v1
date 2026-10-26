import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Public HTTP inspector cannot impersonate signed provider execution', () => {
  it('offers preparation only and links to authenticated scoped provider proof', () => {
    const client = source('components/dsg/app-builder/AppBuilderConsoleClient.tsx');
    expect(client).toContain('execute: false');
    expect(client).toContain('Inspect plan and policy');
    expect(client).toContain('href="/dsg/autonomous-level"');
    expect(client).not.toContain('Execute governed</button>');
    expect(client).not.toContain('runGovernedTool(true');
    expect(client).not.toContain('onApprove={() =>');
    expect(client).not.toContain('approved: true');
  });

  it('keeps the legacy runtime inspector in prepare-only mode', () => {
    const client = source('components/app-builder-agent-runtime-view.tsx');
    expect(client).toContain('body: JSON.stringify({ ...input, execute: false })');
    expect(client).not.toContain('governedTool(input: DsgGovernedToolRequest, execute = false)');
  });

  it('does not equate an approval flag with user-approved signed authority', () => {
    const panel = source('components/dsg/governed-tools/GovernedToolPanels.tsx');
    expect(panel).toContain('not</strong> an authenticated human approval');
    expect(panel).not.toContain('Approval is sent as');
  });
});
