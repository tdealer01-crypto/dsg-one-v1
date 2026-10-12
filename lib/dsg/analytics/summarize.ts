// Turns the caller's own build rows into the numbers the Analytics page shows.
// Everything here is a count of rows that exist. Nothing is estimated: the system stores no token,
// duration or provider data per build, so none is reported (the page says so instead of guessing).

export type AnalyticsRange = '7d' | '30d' | '90d';

export const RANGE_DAYS: Record<AnalyticsRange, number> = { '7d': 7, '30d': 30, '90d': 90 };
// Bars per chart: 7 daily, 6 five-day, 9 ten-day buckets.
const BUCKET_DAYS: Record<AnalyticsRange, number> = { '7d': 1, '30d': 5, '90d': 10 };
const DAY_MS = 86_400_000;

export type BuildRow = { id: string; app_name: string; status: string; created_at: string };

export type AnalyticsSummary = {
  range: AnalyticsRange;
  windowStart: string;
  windowEnd: string;
  stats: {
    totalBuilds: number;
    deployed: number;
    failed: number;
    building: number;
    draft: number;
    // deployed / (deployed + failed): builds still running or never started are not counted as failures.
    successRate: number | null;
    // Change versus the previous window of the same length; null when there is nothing to compare with.
    totalTrend: number | null;
    successTrend: number | null;
  };
  buildActivity: Array<{ label: string; builds: number }>;
  recentBuilds: Array<{ id: string; appName: string; status: string; createdAt: string }>;
};

export function parseRange(value: string | null): AnalyticsRange {
  return value === '30d' || value === '90d' ? value : '7d';
}

function successRate(deployed: number, failed: number): number | null {
  const finished = deployed + failed;
  return finished > 0 ? Math.round((deployed / finished) * 1000) / 10 : null;
}

function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
}

function count(rows: BuildRow[], status: string): number {
  return rows.filter((row) => row.status.toLowerCase() === status).length;
}

function label(ms: number): string {
  return new Date(ms).toISOString().slice(5, 10);
}

export function summarizeBuilds(rows: BuildRow[], range: AnalyticsRange, now: number): AnalyticsSummary {
  const days = RANGE_DAYS[range];
  const bucketDays = BUCKET_DAYS[range];
  const start = now - days * DAY_MS;
  const previousStart = start - days * DAY_MS;

  const stamped = rows
    .map((row) => ({ row, at: Date.parse(row.created_at) }))
    .filter((item) => Number.isFinite(item.at));
  const current = stamped.filter((item) => item.at >= start && item.at <= now).map((item) => item.row);
  const previous = stamped.filter((item) => item.at >= previousStart && item.at < start).map((item) => item.row);

  const deployed = count(current, 'deployed');
  const failed = count(current, 'failed');
  const rate = successRate(deployed, failed);
  const previousRate = successRate(count(previous, 'deployed'), count(previous, 'failed'));

  const bucketCount = days / bucketDays;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({ start: start + i * bucketDays * DAY_MS, builds: 0 }));
  for (const item of stamped) {
    if (item.at < start || item.at > now) continue;
    const index = Math.min(bucketCount - 1, Math.floor((item.at - start) / (bucketDays * DAY_MS)));
    buckets[index].builds += 1;
  }

  const recentBuilds = [...stamped]
    .filter((item) => item.at >= start && item.at <= now)
    .sort((a, b) => b.at - a.at)
    .slice(0, 10)
    .map(({ row }) => ({ id: row.id, appName: row.app_name, status: row.status.toUpperCase(), createdAt: row.created_at }));

  return {
    range,
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(now).toISOString(),
    stats: {
      totalBuilds: current.length,
      deployed,
      failed,
      building: count(current, 'building'),
      draft: count(current, 'draft'),
      successRate: rate,
      totalTrend: percentChange(current.length, previous.length),
      successTrend: rate !== null && previousRate !== null ? Math.round((rate - previousRate) * 10) / 10 : null,
    },
    buildActivity: buckets.map((bucket) => ({ label: label(bucket.start), builds: bucket.builds })),
    recentBuilds,
  };
}
