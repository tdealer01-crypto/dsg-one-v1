import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');
const snapshot = read('components/public-production-snapshot.tsx');
const home = read('app/page.tsx');
const hub = read('app/dsg/access/page.tsx');
const workroom = read('app/dsg/workroom/page.tsx');
const docs = read('public/architecture-3d.html');

describe('2026-10-12 scoped AWS Marketplace production acceptance', () => {
  it('shares one evidence-first component across landing and authenticated hubs', () => {
    for (const page of [home, hub, workroom]) {
      expect(page).toContain('PublicProductionSnapshot');
    }
    expect(snapshot).toContain('Verified 12 October 2026');
    expect(snapshot).toContain('38221386222');
    expect(snapshot).toContain('Marketplace public READ E2E');
    expect(snapshot).toContain('142 records');
  });
  it('does not promote empty catalog or old signed canary to commercial acceptance', () => {
    expect(snapshot).toContain('Empty listings are a real empty catalog');
    expect(snapshot).toContain('Not verified: seller/listing write');
    expect(snapshot).toContain('Marketplace-specific signed Provider v2 receipt');
    expect(snapshot).toContain('This dated receipt does not mean the current website session is OAuth-bound');
    expect(docs).toContain('Cinema approved Connect/Execute');
    expect(docs).toContain('VALID · 142 RECORDS');
  });
  it('links to the same owner activation and canonical evidence record in public site and 3D', () => {
    const issue = 'issues/656#issuecomment-6120341073';
    expect(snapshot).toContain(issue);
    expect(docs).toContain(issue);
    expect(snapshot).toContain('actions/runs/38221386222');
  });
});
