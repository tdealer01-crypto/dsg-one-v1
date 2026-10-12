import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const analytics = read('app/dsg/analytics/page.tsx');
const notifications = read('app/dsg/notifications/page.tsx');

describe('/dsg/analytics and /dsg/notifications read the authenticated APIs, never a built-in demo list', () => {
  it('analytics: no hard-coded builds, chart series, stats or provider shares', () => {
    expect(analytics).not.toMatch(/RECENT_BUILDS|CHART_DATA|PROVIDERS|const STATS/);
    expect(analytics).not.toMatch(/Inventory Tracker|Customer Portal|Gemini|Anthropic/);
    expect(analytics).toContain('/api/dsg/analytics');
    expect(analytics).toMatch(/credentials:\s*['"]include['"]/);
  });

  it('analytics: does not present tokens / cost as numbers', () => {
    expect(analytics).not.toMatch(/tokensUsed|costEstimate|formatTokens/);
  });

  it('notifications: no seeded list, loads and marks read through the API', () => {
    expect(notifications).not.toMatch(/INITIAL_NOTIFICATIONS|relativeTime:\s*['"]/);
    expect(notifications).not.toMatch(/Payments Portal|Auth Service|Welcome to DSG One/);
    expect(notifications).toContain('/api/dsg/notifications');
    expect(notifications).toContain("method: 'PATCH'");
    expect(notifications).toMatch(/credentials:\s*['"]include['"]/);
  });

  it('notifications: no settings switches that only change local state', () => {
    expect(notifications).not.toMatch(/role="switch"|<Toggle|weeklyDigest|emailBuildComplete/);
  });

  it('neither page prints a raw server error body', () => {
    for (const page of [analytics, notifications]) expect(page).not.toMatch(/error\.code|body\.error|\.message\}/);
  });

  it('both use native anchors for navigation', () => {
    for (const page of [analytics, notifications]) {
      expect(page).not.toContain("from 'next/link'");
      expect(page).not.toContain('<Link');
    }
  });
});
