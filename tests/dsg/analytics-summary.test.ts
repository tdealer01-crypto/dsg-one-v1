import { describe, expect, it } from 'vitest';
import { parseRange, summarizeBuilds, type BuildRow } from '@/lib/dsg/analytics/summarize';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const DAY = 86_400_000;
const row = (id: string, status: string, daysAgo: number, name = id): BuildRow => ({
  id, app_name: name, status, created_at: new Date(NOW - daysAgo * DAY).toISOString(),
});

describe('summarizeBuilds counts real rows and invents nothing', () => {
  const rows = [
    row('a', 'deployed', 0.5), row('b', 'deployed', 1), row('c', 'failed', 2), row('d', 'building', 3), row('e', 'draft', 4),
    row('old1', 'deployed', 8), row('old2', 'failed', 9), row('old3', 'failed', 10), // previous 7d window
    row('ancient', 'deployed', 40), // outside both windows
  ];

  it('success rate is deployed / (deployed + failed): running and draft builds are not failures', () => {
    const { stats } = summarizeBuilds(rows, '7d', NOW);
    expect(stats).toMatchObject({ totalBuilds: 5, deployed: 2, failed: 1, building: 1, draft: 1, successRate: 66.7 });
  });

  it('trends compare with the previous window and are null when there is nothing to compare', () => {
    const { stats } = summarizeBuilds(rows, '7d', NOW);
    expect(stats.totalTrend).toBe(66.7); // 5 vs 3
    expect(stats.successTrend).toBe(33.4); // 66.7% vs 33.3%
    const none = summarizeBuilds([row('a', 'deployed', 1)], '7d', NOW).stats;
    expect(none.totalTrend).toBeNull();
    expect(none.successTrend).toBeNull();
  });

  it('with no finished builds the success rate is null, not 0% and not 100%', () => {
    expect(summarizeBuilds([row('a', 'building', 1), row('b', 'draft', 1)], '7d', NOW).stats.successRate).toBeNull();
    expect(summarizeBuilds([], '7d', NOW).stats).toMatchObject({ totalBuilds: 0, successRate: null, totalTrend: null });
  });

  it('every build inside the window is in exactly one bar; the number of bars follows the range', () => {
    for (const [range, bars] of [['7d', 7], ['30d', 6], ['90d', 9]] as const) {
      const { buildActivity, stats } = summarizeBuilds(rows, range, NOW);
      expect(buildActivity).toHaveLength(bars);
      expect(buildActivity.reduce((n, b) => n + b.builds, 0)).toBe(stats.totalBuilds);
    }
    expect(summarizeBuilds(rows, '30d', NOW).stats.totalBuilds).toBe(8); // the 40-day-old one is outside
  });

  it('lists the newest 10 builds with their real names, newest first, and ignores unparseable dates', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(`b${i}`, 'deployed', i / 10, `App ${i}`));
    const { recentBuilds } = summarizeBuilds([...many, { id: 'bad', app_name: 'Bad', status: 'failed', created_at: 'not-a-date' }], '7d', NOW);
    expect(recentBuilds).toHaveLength(10);
    expect(recentBuilds[0]).toMatchObject({ id: 'b0', appName: 'App 0', status: 'DEPLOYED' });
    expect(recentBuilds.find((b) => b.id === 'bad')).toBeUndefined();
  });

  it('reports no token / cost / provider numbers at all', () => {
    expect(JSON.stringify(summarizeBuilds(rows, '7d', NOW))).not.toMatch(/token|cost|provider/i);
  });

  it('an unknown range falls back to 7d', () => {
    expect(parseRange('bogus')).toBe('7d');
    expect(parseRange(null)).toBe('7d');
    expect(parseRange('90d')).toBe('90d');
  });
});
