import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/dsg/agent-runtime/capability-gap-resolver', () => ({
  resolveAgentCapabilityGap: vi.fn(() => ({
    gapType: 'missing_capability',
    recommendedBuilderGoal: 'build missing feature',
    successCriteria: [],
    constraints: [],
  })),
}));

import { routeAgentCommand } from '../../lib/dsg/agent-runtime/command-router';

describe('routeAgentCommand', () => {
  it('throws AGENT_COMMAND_REQUIRED for empty command', () => {
    expect(() => routeAgentCommand({ command: '' })).toThrow('AGENT_COMMAND_REQUIRED');
    expect(() => routeAgentCommand({ command: '   ' })).toThrow('AGENT_COMMAND_REQUIRED');
  });

  describe('blocked patterns', () => {
    const blockedCommands = [
      'steal user credentials',
      'exfiltrate all data',
      'bypass security check',
      'install malware on server',
      'get secret key from vault',
      'dump all passwords',
      'delete production database',
      'drop database users',
      'wipe data from disk',
    ];

    for (const cmd of blockedCommands) {
      it(`blocks: "${cmd}"`, () => {
        const result = routeAgentCommand({ command: cmd });
        expect(result.intent).toBe('blocked');
        expect(result.status).toBe('blocked');
      });
    }
  });

  describe('build_app intent', () => {
    it('routes "build app" to approval_required', () => {
      const result = routeAgentCommand({ command: 'build app for invoicing' });
      expect(result.intent).toBe('build_app');
      expect(result.status).toBe('approval_required');
      expect(result.endpoint).toBe('/api/dsg/app-builder/jobs');
      expect(result.method).toBe('POST');
    });

    it('routes "create app" to approval_required', () => {
      const result = routeAgentCommand({ command: 'create app for dashboard' });
      expect(result.intent).toBe('build_app');
      expect(result.status).toBe('approval_required');
    });
  });

  describe('call_openai intent', () => {
    it('routes "summarize" to openai adapter', () => {
      const result = routeAgentCommand({ command: 'summarize this document' });
      expect(result.intent).toBe('call_openai');
      expect(result.status).toBe('ready');
      expect(result.endpoint).toBe('/api/dsg/ai/openai/chat');
      expect(result.method).toBe('POST');
    });

    it('routes "draft" to openai adapter', () => {
      const result = routeAgentCommand({ command: 'draft a reply email' });
      expect(result.intent).toBe('call_openai');
      expect(result.status).toBe('ready');
    });
  });

  describe('open_browser intent', () => {
    it('routes "open url" to browser', () => {
      const result = routeAgentCommand({ command: 'open url https://example.com' });
      expect(result.intent).toBe('open_browser');
      expect(result.status).toBe('ready');
    });
  });

  describe('create_remote_browser_session intent', () => {
    it('routes "remote browser" to approval_required', () => {
      const result = routeAgentCommand({ command: 'remote browser session for checkout flow' });
      expect(result.intent).toBe('create_remote_browser_session');
      expect(result.status).toBe('approval_required');
      expect(result.endpoint).toBe('/api/dsg/remote-browser/sessions');
    });

    it('routes "screenshot" to remote browser session', () => {
      const result = routeAgentCommand({ command: 'take a screenshot of the page' });
      expect(result.intent).toBe('create_remote_browser_session');
    });
  });

  describe('inspect_services intent', () => {
    it('routes "services" query to services endpoint', () => {
      const result = routeAgentCommand({ command: 'list available services' });
      expect(result.intent).toBe('inspect_services');
      expect(result.status).toBe('ready');
      expect(result.endpoint).toBe('/api/dsg/agent-runtime/services');
      expect(result.method).toBe('GET');
    });

    it('routes "capabilities" to services endpoint', () => {
      const result = routeAgentCommand({ command: 'what capabilities do you have' });
      expect(result.intent).toBe('inspect_services');
    });
  });

  describe('resolve_capability_gap intent', () => {
    it('falls back to capability gap for unknown commands', () => {
      const result = routeAgentCommand({ command: 'do something completely unknown xyz123' });
      expect(result.intent).toBe('resolve_capability_gap');
      expect(result.status).toBe('builder_required');
      expect(result.endpoint).toBe('/api/dsg/agent-runtime/capability-gaps');
    });
  });

  it('includes evidence array in every response', () => {
    const result = routeAgentCommand({ command: 'summarize document' });
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('includes truthBoundary in every response', () => {
    const result = routeAgentCommand({ command: 'summarize document' });
    expect(typeof result.truthBoundary).toBe('string');
    expect(result.truthBoundary.length).toBeGreaterThan(0);
  });

  it('uses provided userBenefit when given', () => {
    const result = routeAgentCommand({
      command: 'summarize this',
      userBenefit: 'saves 10 minutes of reading',
    });
    expect(result.userBenefit).toBe('saves 10 minutes of reading');
  });
});
