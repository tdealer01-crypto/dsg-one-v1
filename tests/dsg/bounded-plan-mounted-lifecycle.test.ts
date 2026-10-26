/** Mounted UI regressions. All identities, MFA and provider replies are fixtures. */
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spacetimePayloadHash, type JsonRecord } from '@/lib/dsg/user-bound/workroom-contract';

const boundary = vi.hoisted(() => ({
  bounded: vi.fn(), mfa: vi.fn(), authenticated: vi.fn(), token: vi.fn(),
}));
vi.mock('@/lib/dsg/user-bound/browser-session', () => ({
  DSG_AUTH0_CALLBACK: 'https://dsg.pics/callback',
  getDsgBrowserSession: () => ({ isAuthenticated: boundary.authenticated, getTokenSilently: boundary.token }),
}));
vi.mock('@/lib/dsg/user-bound/bounded-plan-client', () => ({
  boundedPlanRequest: boundary.bounded,
  getBoundedApproverSession: () => ({ getTokenWithPopup: boundary.mfa }),
}));
vi.mock('@/lib/dsg/user-bound/workroom-contract', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/dsg/user-bound/workroom-contract')>(),
  // Provider-receipt verification has its own cryptographic contract tests.
  workroomReceiptMatches: async () => true,
}));
vi.mock('@/components/dsg-kaggle-gpu-status', () => ({ DsgKaggleGpuStatus: () => null }));
vi.mock('@/components/dsg-cinema-oauth-viewer', () => ({ DsgCinemaOauthViewer: () => null }));
import { DsgLiveWorkroom } from '@/components/dsg-live-workroom';

const planHash = 'a'.repeat(64);
const content = 'private file content must stay out of planner history';
const routes = [
  ['route.desktop-native.status', 'device.remote.status', 'node.desktop-native', false],
  ['route.desktop-native.fs-write', 'device.fs.write', 'node.desktop-native', true],
  ['route.desktop-native.fs-read', 'device.fs.read', 'node.desktop-native', false],
  ['route.agent.plan', 'action.plan', 'node.agent.dsg-v0', false],
].map(([route_id, capability, target_node, signed]) => ({
  route_id, capability, target_node, source_node: 'node.web',
  approval_required: signed, signed_approval_required: signed, bind_payload: true,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function text(node: ReactTestInstance): string {
  return node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
}
async function flush() { await new Promise(resolve => setTimeout(resolve, 0)); }

describe('mounted bounded Workroom lifecycle', () => {
  let mounted: ReactTestRenderer | undefined;
  let currentUrl: URL;
  let identity: JsonRecord;
  let staged: JsonRecord[];
  let toolRequests: JsonRecord[];
  let statusReport: JsonRecord | undefined;
  let popup: { closed: boolean; close: ReturnType<typeof vi.fn> };
  let replaceState: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  function button(label: string) {
    const found = mounted!.root.findAllByType('button').find(node => text(node).includes(label));
    if (!found) throw new Error('Missing UI button: ' + label + ' status=' + mounted!.root.findAllByProps({ role: 'status' }).map(text).join('|'));
    return found;
  }
  async function waitFor(predicate: () => boolean) {
    for (let attempt = 0; attempt < 40 && !predicate(); attempt++) {
      await act(async () => { await flush(); });
    }
    expect(predicate()).toBe(true);
  }
  async function click(label: string) {
    const target = button(label);
    expect(target.props.disabled).not.toBe(true);
    await act(async () => { target.props.onClick(); await flush(); });
  }
  async function mount(url = 'https://dsg.pics/dsg/workroom') {
    currentUrl = new URL(url);
    await act(async () => {
      mounted = create(React.createElement(DsgLiveWorkroom), {
        createNodeMock: () => ({ scrollIntoView: vi.fn(), focus: vi.fn() }),
      });
      await flush();
    });
  }
  async function unmount() {
    if (!mounted) return;
    await act(async () => { mounted!.unmount(); await flush(); });
    mounted = undefined;
  }
  async function goal() {
    await act(async () => {
      mounted!.root.findByProps({ id: 'workroom-goal' }).props.onChange({ target: { value: 'create the next file' } });
    });
    await act(async () => {
      mounted!.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
      await flush();
    });
  }
  async function review() {
    await goal();
    await click('ตรวจแผนแบบมีขอบเขต');
    await waitFor(() => mounted!.root.findAllByProps({ type: 'checkbox' }).length === 1);
    expect(boundary.bounded.mock.calls.slice(-2).map(call => call[0])).toEqual(['stage', 'view']);
    await act(async () => {
      mounted!.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: true } });
    });
  }
  async function readyReview() {
    await mount();
    await click('สั่งงานอุปกรณ์');
    await click('ตรวจอุปกรณ์ที่เชื่อมต่อ');
    await click('Agent v0 · วางแผนด้วย Qwen');
    await review();
  }
  function completeReport(): JsonRecord {
    const index = staged.length;
    const request = (staged[index - 1].requests as JsonRecord[])[0];
    return {
      workflow_version: 'dsg.bounded-plan.workflow.v1', request_id: 'request-' + index,
      plan_id: request.plan_id, plan_hash: request.plan_hash, workspace_id: 'workspace-1',
      device_id: 'device-1', status: 'COMPLETED', completion_verified: true,
      automatic_retry: false, total_steps: 1, completed_steps: 1,
      authorization_status: 'GRANTED', grant_id: 'grant-' + index,
      steps: [{ step_id: 'write-1', route_id: request.route_id, status: 'COMPLETED',
        evidence_hash: index.toString(16).padStart(64, '0') }],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    staged = []; toolRequests = []; statusReport = undefined;
    identity = { ok: true, principal: { sub: 'owner-1' }, workspaceId: 'workspace-1', workspaceRole: 'OWNER' };
    currentUrl = new URL('https://dsg.pics/dsg/workroom');
    popup = { closed: false, close: vi.fn(() => { popup.closed = true; }) };
    open = vi.fn(() => popup);
    replaceState = vi.fn((_state, _unused, url: string) => { currentUrl = new URL(url, currentUrl); });
    vi.stubGlobal('React', React);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('window', {
      get location() { return currentUrl; }, open,
      history: { state: null, replaceState }, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    vi.stubGlobal('document', { hidden: false, getElementById: () => ({ focus: vi.fn() }),
      addEventListener: vi.fn(), removeEventListener: vi.fn() });
    boundary.authenticated.mockResolvedValue(true);
    boundary.token.mockResolvedValue('requester-fixture');
    boundary.mfa.mockResolvedValue('approver-fixture');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/dsg/identity/link') return Response.json(identity);
      if (url !== '/api/dsg/spacetime/user-tools') throw new Error('Unexpected fixture URL ' + url);
      const body = JSON.parse(String(init?.body));
      toolRequests.push(structuredClone(body));
      let receipt: JsonRecord;
      if (body.tool === 'spacetime_capability_catalog') receipt = { routes };
      else if (body.tool === 'spacetime_compose') receipt = { verdict: 'BOUND', plan_hash: planHash };
      else if (body.tool === 'spacetime_verify_evidence') receipt = { valid: true };
      else if (body.tool === 'spacetime_execute') {
        receipt = { evidence: { evidence_hash: 'd'.repeat(64) }, result:
          body.arguments.route_id === 'route.agent.plan' ? {
            authority: 'proposal-only', brain_mode: 'local_qwen3_planner', model: 'DSG-Agent-v0-fixture',
            status: 'ACTION_REQUIRED', action_proposal: { action: 'device.fs.write',
              arguments: { path: '/fixture/new-' + (staged.length + 1), content, mode: 'create_new' } },
          } : { ok: true, provider: 'dsg-desktop-native', action: 'device.remote.status', device_id: 'device-1',
            execution: { ok: true, device: { device_id: 'device-1', label: 'Fixture device', online: true, registry_bound: true } } },
        };
      } else throw new Error('Unexpected fixture tool ' + body.tool);
      return Response.json({ ok: true, userPrincipalVerified: true, evidenceVerified: true, receipt });
    }));
    boundary.bounded.mockImplementation(async (operation: string, _token: string, args: JsonRecord) => {
      if (operation === 'stage') {
        staged.push(structuredClone(args));
        return { request_id: 'request-' + staged.length, expires_at: Math.floor(Date.now() / 1000) + 240 };
      }
      if (operation === 'view') {
        const request = (staged[staged.length - 1].requests as JsonRecord[])[0];
        return { request_id: args.request_id, status: 'VIEWED', review_digest: 'b'.repeat(64), scope: {
          plan_id: request.plan_id, plan_hash: request.plan_hash, workspace_id: 'workspace-1', device_id: 'device-1',
          agent_id: 'dsg-web-workroom', expires_at: Math.floor(Date.now() / 1000) + 240,
          steps: [{ step_id: 'write-1', route_id: request.route_id,
            payload_hash: await spacetimePayloadHash(request.payload), origin: 'https://aws.dsg.pics',
            risk: 'high', effect: 'file_write_exact', target_ref: (request.payload as JsonRecord).arguments &&
              ((request.payload as JsonRecord).arguments as JsonRecord).path, review_summary: 'Create the exact fixture file' }],
        } };
      }
      if (operation === 'confirm') return { grant_id: 'grant-' + staged.length };
      if (operation === 'status') return statusReport ?? completeReport();
      if (operation === 'revoke') return { ok: true };
      throw new Error('Unexpected fixture operation ' + operation);
    });
  });
  afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

  it('does not rewrite a newly visited page when confirmation resolves after unmount', async () => {
    await readyReview();
    const confirmation = deferred<JsonRecord>();
    boundary.bounded.mockImplementationOnce(() => confirmation.promise);
    await click('ยืนยันแผนนี้ด้วย MFA ใหม่');
    expect(boundary.bounded.mock.calls.at(-1)?.[0]).toBe('confirm');
    await unmount();
    currentUrl = new URL('https://dsg.pics/dsg/history?bounded_request_id=newer-request');
    replaceState.mockClear();
    await act(async () => { confirmation.resolve({ grant_id: 'old-grant' }); await flush(); });
    expect(replaceState).not.toHaveBeenCalled();
    expect(currentUrl.searchParams.get('bounded_request_id')).toBe('newer-request');
    expect(boundary.bounded.mock.calls.filter(call => call[0] === 'status')).toHaveLength(0);
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it.each(['unmount', 'workspace change'])('does not confirm after %s during MFA', async change => {
    await readyReview();
    const mfa = deferred<string>();
    boundary.mfa.mockReturnValueOnce(mfa.promise);
    await click('ยืนยันแผนนี้ด้วย MFA ใหม่');
    expect(boundary.mfa).toHaveBeenCalledOnce();
    if (change === 'unmount') await unmount();
    else identity = { ...identity, workspaceId: 'another-workspace' };
    await act(async () => { mfa.resolve('approver-fixture'); await flush(); });
    expect(boundary.bounded.mock.calls.filter(call => call[0] === 'confirm')).toHaveLength(0);
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('retains an uncertain confirmation as status-only without replay', async () => {
    await readyReview();
    boundary.bounded.mockRejectedValueOnce(new Error('BOUNDED_PLAN_CONFIRMATION_UNCERTAIN'));
    await click('ยืนยันแผนนี้ด้วย MFA ใหม่');
    expect(mounted!.root.findAllByType('button').some(node => text(node).includes('ยืนยันแผนนี้ด้วย MFA ใหม่'))).toBe(false);
    expect(currentUrl.searchParams.get('bounded_request_id')).toBe('request-1');
    statusReport = { status: 'WAITING_WORKER', authorization_status: 'GRANTED', grant_id: 'grant-1',
      plan_id: (staged[0].requests as JsonRecord[])[0].plan_id, plan_hash: planHash, device_id: 'device-1' };
    await click('อ่านสถานะเดิม');
    expect(boundary.bounded.mock.calls.filter(call => call[0] === 'confirm')).toHaveLength(1);
    expect(boundary.mfa).toHaveBeenCalledOnce();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('restores a request ID with status/revoke controls and no consent replay', async () => {
    statusReport = { status: 'WAITING_WORKER', authorization_status: 'GRANTED', grant_id: 'existing-grant' };
    await mount('https://dsg.pics/dsg/workroom?bounded_request_id=existing-request');
    expect(mounted!.root.findAllByType('input').filter(node => node.props.type === 'checkbox')).toHaveLength(0);
    expect(mounted!.root.findAllByType('button').some(node => text(node).includes('ยืนยันแผนนี้ด้วย MFA ใหม่'))).toBe(false);
    await click('อ่านสถานะเดิม');
    await click('เพิกถอนสิทธิ์แผนนี้');
    expect(boundary.bounded.mock.calls.map(call => call[0])).toEqual(['status', 'revoke', 'status']);
    expect(boundary.mfa).not.toHaveBeenCalled();
    expect(staged).toHaveLength(0);
  });

  it('does not consume consent when a popup is blocked and closes a rejected MFA popup', async () => {
    await readyReview();
    open.mockReturnValueOnce(null);
    await click('ยืนยันแผนนี้ด้วย MFA ใหม่');
    expect(boundary.mfa).not.toHaveBeenCalled();
    boundary.mfa.mockRejectedValueOnce(new Error('MFA_CANCELLED'));
    await click('ยืนยันแผนนี้ด้วย MFA ใหม่');
    expect(popup.close).toHaveBeenCalledOnce();
    expect(boundary.bounded.mock.calls.filter(call => call[0] === 'confirm')).toHaveLength(0);
    expect(button('ยืนยันแผนนี้ด้วย MFA ใหม่').props.disabled).toBe(false);
  });

  it('sends each completed bounded write to the next planner once, without content, bounded to six entries', async () => {
    await readyReview();
    for (let index = 0; index < 7; index++) {
      if (index > 0) await review();
      await click('ยืนยันแผนนี้ด้วย MFA ใหม่');
      await click('อ่านสถานะเดิม');
      await click('ปิดการติดตามแผนนี้');
    }
    await goal();
    const planning = toolRequests.filter(call => call.tool === 'spacetime_execute' &&
      (call.arguments as JsonRecord).route_id === 'route.agent.plan');
    const last = ((planning.at(-1)!.arguments as JsonRecord).payload as JsonRecord).verified_history as JsonRecord[];
    const writes = last.filter(item => item.action === 'device.fs.write');
    expect(writes).toHaveLength(6);
    expect(new Set(writes.map(item => item.evidence_hash)).size).toBe(6);
    expect(writes.every(item => item.outcome === 'VERIFIED' && item.route_id === 'route.desktop-native.fs-write')).toBe(true);
    expect(JSON.stringify(last)).not.toContain(content);
    expect(last).toHaveLength(6);
  });
});
