import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateDsgAutonomousLevelGate } from '@/lib/dsg/autonomous-level/capability-gate';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('runtime truth and authenticated workspace ownership', () => {
  it('never turns historical local-only provider summary into whole-system 9/9', () => {
    const gate = evaluateDsgAutonomousLevelGate();
    expect(gate.complete).toBe(false);
    expect(gate.claim).not.toBe('DSG_AUTONOMOUS_LEVEL_COMPLETE');
    expect(gate.score).toBeLessThan(1);
    expect(gate.missingRequired).toContain('remote_browser_session');
    expect(gate.missingRequired).toContain('sandbox_isolation');
    expect(gate.capabilities.find(c => c.id === 'remote_browser_session')?.status).toBe('BLOCKED');
    expect(gate.capabilities.find(c => c.id === 'auth_rbac')?.status).toBe('PARTIAL');
  });

  it('hashes nested capability changes, even when passed count and missing IDs do not change', () => {
    const blocked = evaluateDsgAutonomousLevelGate({ sandbox_isolation: 'BLOCKED' });
    const partial = evaluateDsgAutonomousLevelGate({ sandbox_isolation: 'PARTIAL' });
    expect(blocked.passed).toBe(partial.passed);
    expect(blocked.missingRequired).toEqual(partial.missingRequired);
    expect(blocked.proofHash).not.toBe(partial.proofHash);
  });

  it('does not send demo workspace, spoofed actor, or client role headers', () => {
    for (const path of [
      'components/dsg/app-builder/AppBuilderConsoleClient.tsx',
      'components/dsg/app-builder/SandboxWorkbenchClient.tsx',
      'components/app-builder-agent-runtime-view.tsx',
    ]) {
      const content = source(path);
      expect(content).not.toContain("'x-dsg-workspace-id':");
      expect(content).not.toContain("'x-dsg-actor-id':");
      expect(content).not.toContain("'x-dsg-actor-role':");
      expect(content).not.toContain("'x-dsg-permissions':");
    }
  });
});
