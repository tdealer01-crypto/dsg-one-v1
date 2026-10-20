import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeApprovalAuthProblem } from '@/lib/dsg/client/approval-auth-diagnostics';
import { approvalPreview } from '@/lib/dsg/client/approval-preview';

const source = readFileSync(join(process.cwd(), 'app/dsg/approvals/approval-client.tsx'), 'utf8');

describe('Owner-confirmation UX and Auth0 callback recovery', () => {
  it('displays stable, token-free diagnostics for a lost OAuth transaction', () => {
    const result = describeApprovalAuthProblem({ name: 'MissingTransactionError', error: 'missing_transaction', message: 'Bearer SECRET' }, 'callback');
    expect(result.code).toBe('AUTH0_CALLBACK_TRANSACTION_LOST');
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result.nextAction).toContain('Chrome');
  });
  it('never exposes raw authentication callback details in a generic error', () => {
    const result = describeApprovalAuthProblem({ message: 'Sensitive access_token=SECRET' }, 'session');
    expect(result.code).toBe('AUTH0_SESSION_CHECK_FAILED');
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('simplifies the protected UX to signed-in owner plus one exact confirmation', () => {
    expect(source).toContain('ยืนยันว่าเป็นเจ้าของด้วย Auth0');
    expect(source).toContain('ยืนยันตัวตนและอนุมัติงานนี้');
    expect(source).toContain('ไม่อนุมัติงานนี้');
    expect(source).toContain('<details className="rounded-xl border border-slate-700 p-3 text-xs">');
    expect(source).toContain('onClick={() => void decide(\'APPROVE\')}');
    expect(source).not.toContain('localStorage.setItem');
    expect(source).not.toContain('sessionStorage.setItem');
  });
  it('still binds approval to the same viewed ID and signed MFA', () => {
    expect(source).toContain("tool('spacetime_get_approval'");
    expect(source).toContain("tool('spacetime_resolve_approval'");
    expect(source).toContain("proof.error === 'FRESH_SIGNED_MFA_REQUIRED'");
    expect(source).toContain("ext_dsg_stepup: '1'");
    expect(source).toContain("expiry <= Date.now()");
    expect(source).toContain('knownRiskTier(selected.risk_tier)');
    expect(source).toContain('await c.handleRedirectCallback()');
  });
  it('shows a specific Cinema description only for the exact approved destination and steps', () => {
    const matching = approvalPreview({
      route_id: 'route.cinema-remote.execute',
      payload: { action: 'browser.remote.run', arguments: { steps: [
        { action: { kind: 'browser.navigate', parameters: { url: 'https://dsg.pics/dsg/workroom' } } },
        { action: { kind: 'browser.extract' } },
        { action: { kind: 'browser.screenshot' } },
      ] } },
    });
    expect(matching.title).toContain('Workroom');
    const nonmatching = approvalPreview({
      route_id: 'route.cinema-remote.execute',
      payload: { action: 'browser.remote.run', arguments: { steps: [
        { action: { kind: 'browser.navigate', parameters: { url: 'https://example.org/private' } } },
        { action: { kind: 'browser.extract' } },
        { action: { kind: 'browser.screenshot' } },
      ] } },
    });
    expect(nonmatching.title).not.toContain('Workroom');
    expect(nonmatching.description).toContain('ตรวจสอบ');
  });
});
