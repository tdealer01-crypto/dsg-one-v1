import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const page = readFileSync(join(process.cwd(), 'app/dsg/history/page.tsx'), 'utf8');

describe('/dsg/history shows real data, never a fabricated list', () => {
  it('has no hard-coded mock builds', () => {
    expect(page).not.toMatch(/MOCK_[A-Z_]+/);
    expect(page).not.toMatch(/relativeTime:\s*['"]/);
  });

  it('loads from the authenticated history API with the session cookie', () => {
    expect(page).toContain('/api/dsg/history');
    expect(page).toMatch(/credentials:\s*['"]include['"]/);
  });

  it('does not offer View/Restore as working actions (they have no backing API)', () => {
    const buttons = page.match(/<button[\s\S]*?<\/button>/g) ?? [];
    const dead = buttons.filter((b) => /ดู\s*<\/button>|กู้คืน\s*<\/button>/.test(b));
    expect(dead.length).toBe(2);
    for (const b of dead) expect(b).toMatch(/\bdisabled\b/);
  });

  it('never prints the raw server error body to the user', () => {
    expect(page).not.toMatch(/error\.code|body\.error|\.message\}/);
  });
});
